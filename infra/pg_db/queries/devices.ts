// infra/pg_db/queries/devices.ts
import pool from "../db_config"
import { 
    NewDevice, 
    NewPowerReading, 
    UpdateDevice, 
    UpdateDeviceMetadata,
    UpdateDevicePolicy
} from "./types/types";

//=========================================================
// READ
//=========================================================
export async function getAllDevices(): Promise<any[]> {
    const { rows } = await pool.query(`
        SELECT id, name, status 
        FROM devices 
        WHERE is_deleted = FALSE
        ORDER BY id
    `)

    return rows
}

export async function getDeviceById(deviceId: number): Promise<any | null> {
    const { rows } = await pool.query(`
        SELECT id, name, status  
        FROM devices 
        WHERE id = $1 AND is_deleted = FALSE
    `, [deviceId])

    return rows[0] ?? null
}

export async function getDeviceIdByName(deviceName: string): Promise<number | null> {
    const { rows } = await pool.query(`
        SELECT id
        FROM devices
        WHERE name = $1 AND is_deleted = FALSE LIMIT 1
    `, [deviceName.trim()])

    return rows[0]?.id ?? null
}

export async function getAllDevicesByUserId(userId: number): Promise<any | null> {
    const { rows } = await pool.query(`
        SELECT 
            d.id AS device_id,
            d.name AS device_name,
            d.status AS device_status,
            d.last_seen,
            u.role_id,
            r.role AS role_name,
            u.status AS user_device_status,
            u.accepted_at
        FROM devices d
        JOIN user_device_map u 
            ON d.id = u.device_id
        LEFT JOIN device_roles r
            ON u.role_id = r.id
        WHERE u.user_id = $1 AND d.is_deleted = FALSE
        ORDER BY d.id
    `, [userId])

    return rows ?? null
}

export async function getLatestReadingByDeviceName(deviceName: string) {
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) return null

    const { rows } = await pool.query(
        `SELECT voltage, current, power, cumulative_energy, recorded_at
        FROM power_readings 
        WHERE device_id = $1 
        ORDER BY recorded_at DESC LIMIT 1`,
        [deviceId]
    )
    
    return rows[0] ?? null
}

export async function getEnergyStatsByDeviceName(deviceName: string, periodType: 'daily'|'weekly'|'monthly', periodStart: string) {
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) return null

    const { rows } = await pool.query(
        `SELECT total_energy, avg_power, max_power, period_type, period_start, updated_at
        FROM device_energy_stats
        WHERE device_id = $1 AND period_type = $2 AND period_start = $3
        LIMIT 1`,
        [deviceId, periodType, periodStart]
    )

    // return zeros if no stats found 
    return rows[0] ?? { 
        period_type: periodType, 
        period_start: periodStart,
        updated_at: null, 
        total_energy: 0, 
        avg_power: 0, 
        max_power: 0 
    }
}


export async function getDevicePolicy(deviceName: string) {
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) return null

    const { rows } = await pool.query(
        `SELECT daily_energy_limit, allowed_start, allowed_end, is_enforced, created_at 
        FROM device_policies 
        WHERE device_id = $1 
        LIMIT 1`, 
        [deviceId]
    )

    return rows[0] ?? null
}

export async function getAllReadingsByDeviceName(deviceName: string) {
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) return null

    const { rows } = await pool.query(
        `SELECT voltage, current, power, cumulative_energy, recorded_at
        FROM power_readings
        WHERE device_id = $1
        ORDER BY recorded_at DESC`,
        [deviceId]
    )

    return rows ?? []
}

export async function getFaultyDevices(): Promise<any[]> {
    try {
        const { rows } = await pool.query(`
            SELECT id, name, empty_payload_count, last_seen, is_faulty
            FROM devices
            WHERE is_faulty = TRUE 
              AND is_deleted = FALSE
            ORDER BY last_seen DESC NULLS LAST
        `)
        return rows
    } catch (err) {
        console.error('Error fetching faulty devices:', err)
        throw err
    }
}


//=========================================================
// CREATE
//=========================================================
export async function addDevice({ deviceName, userId }: NewDevice): Promise<any> {
    // we want to insert into devices and user_device_map atomically
    // so we do this in a transaction

    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        const { rows: deviceRows } = await client.query<{ id: number }>(`
            INSERT INTO devices (name)
            VALUES ($1)
            RETURNING id, name, status, last_seen
        `, [deviceName.trim()])

        const deviceId = deviceRows[0].id

        // ensure device role "owner" exists and get its id
        const { rows: roleRows } = await client.query<{ id: number }>(`
            SELECT id
            FROM device_roles
            WHERE role = 'owner'
            LIMIT 1
        `)

        let ownerRoleId: number;
        if (roleRows.length > 0) {
            ownerRoleId = roleRows[0].id

        } else {
            const { rows: newRoleRows } = await client.query<{ id: number }>(`
                INSERT INTO device_roles (role, description) 
                VALUES ('owner', 'Device owner')
                RETURNING id
            `)

            ownerRoleId = newRoleRows[0].id
        }

        // map user -> device as owner (accepted immediately)
        await client.query(`
            INSERT INTO user_device_map (user_id, device_id, role_id, status, accepted_at)
            VALUES ($1, $2, $3, 'active', NOW())
        `, [userId, deviceId, ownerRoleId])

        // record device_registration_info
        await client.query(`
            INSERT INTO device_registration_info (device_id, registered_by, registered_at)
            VALUES ($1, $2, NOW())
        `, [deviceId, userId])

        await client.query("COMMIT")
        return deviceRows[0]

    } catch (err: any) {
        await client.query("ROLLBACK")
        throw err

    } finally {
        client.release()
    }
}


export async function addPowerReadingByDeviceName(payload: NewPowerReading): Promise<any> {
    const { deviceName, voltage, current, power, cumulativeEnergy, recordedAt } = payload
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) throw new Error(`Device not found ${deviceName}`)
    
    const isEmptyPayload = !voltage && !current && !power && !cumulativeEnergy
    const recordedAtVal = recordedAt ? new Date(recordedAt).toISOString() : new Date().toISOString()

    // safety net: fallback to zero if payload is empty or missing fields
    const safeVoltage = voltage ?? 0
    const safeCurrent = current ?? 0
    const instPower = voltage !== undefined && current !== undefined ? voltage * current : undefined
    const safePower = power ?? instPower ?? 0
    const safeCumulativeEnergy = cumulativeEnergy ?? 0

    // insert into DB - always inserting a valid numeric record
    const { rows } = await pool.query(`
        INSERT INTO power_readings (device_id, voltage, current, power, cumulative_energy, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`, 
        [deviceId, safeVoltage, safeCurrent, safePower, safeCumulativeEnergy, recordedAtVal]
    )

    // handle case where all fields are missing/zero
    if (isEmptyPayload) {
        // fetch updated count 
        const { rows: [{ empty_payload_count }] } = await pool.query(`
            WITH updated AS (
                UPDATE devices
                SET empty_payload_count = COALESCE(empty_payload_count, 0) + 1
                WHERE id = $1
                RETURNING empty_payload_count
            )
            SELECT empty_payload_count FROM updated
        `, [deviceId])

        // if count exceeds threshold, mark device as faulty
        if (empty_payload_count >= 5) {
            console.warn(`[ALERT] Device ${deviceName} has sent ${empty_payload_count} empty payloads!.`)
            await pool.query(`
                UPDATE devices
                SET is_faulty = TRUE
                WHERE id = $1
            `, [deviceId])
        }
    } else {
        // reset empty_payload_count on valid reading
        await pool.query(`
            UPDATE devices
            SET empty_payload_count = 0, is_faulty = FALSE
            WHERE id = $1
        `, [deviceId])
    }

    return rows[0]
}


//=========================================================
// UPDATE
//=========================================================
export async function updateDevice({ id, deviceName, status, lastSeen }: UpdateDevice): Promise<any | null> {
    const updates: string[] = []
    const values: (string | number)[] = []
    let idx = 1

    if (deviceName !== undefined) {
        updates.push(`name = $${idx}`)
        values.push(deviceName)
        idx++
    }

    if (status !== undefined) {
        updates.push(`status = $${idx}`)
        values.push(status)
        idx++
    }

    if (lastSeen !== undefined) {
        updates.push(`last_seen = $${idx}`)
        values.push(lastSeen)
        idx++
    }

    if (updates.length === 0)
        return null

    const query = `
        UPDATE devices
        SET ${updates.join(", ")}
        WHERE id = $${idx} AND is_deleted = FALSE
        RETURNING *
    `

    values.push(id)
    const { rows } = await pool.query(query, values)
    return rows[0] ?? null
}


export async function upsertDeviceEnergyStat(
    deviceName: string, 
    periodType: 'daily'|'weekly'|'monthly', 
    periodStart: string, 
    totalEnergy: number, 
    avgPower?: number, 
    maxPower?: number
) : Promise<any> {

    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) throw new Error(`Device not found: ${deviceName}`)

    const { rows } = await pool.query(
        `INSERT INTO device_energy_stats (device_id, period_type, period_start, total_energy, avg_power, max_power, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (device_id, period_type, period_start)
        DO UPDATE SET
            total_energy = EXCLUDED.total_energy,
            avg_power = EXCLUDED.avg_power,
            max_power = EXCLUDED.max_power,
            updated_at = NOW()
        RETURNING *`,
        [deviceId, periodType, periodStart, totalEnergy, avgPower ?? 0, maxPower ?? 0]
    )

    return rows[0]
}


export async function upsertDeviceImage({ deviceName, imageUrl }: UpdateDeviceMetadata) {
    const deviceId = await getDeviceIdByName(deviceName)
    if (!deviceId) throw new Error(`Device not found: ${deviceName}`)

    // device_metadata is 1:1 keyed by device_id; we upsert
    const { rows } = await pool.query(
        `INSERT INTO device_metadata (device_id, image_url)
        VALUES ($1, $2)
        ON CONFLICT (device_id)
        DO UPDATE SET image_url = EXCLUDED.image_url
        RETURNING *`,
        [deviceId, imageUrl]
    )

    return rows[0]
}

export async function upsertDevicePolicy(payload: UpdateDevicePolicy) {
    const { deviceName, dailyEnergyLimit, allowedStart, allowedEnd, isEnforced } = payload
    const deviceId = await getDeviceIdByName(deviceName)
    
    if (!deviceId) throw new Error(`Device not found: ${deviceName}`)

    const { rows } = await pool.query(
        `INSERT INTO device_policies (device_id, daily_energy_limit, allowed_start, allowed_end, is_enforced, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (device_id)
        DO UPDATE SET
            daily_energy_limit = COALESCE(EXCLUDED.daily_energy_limit, device_policies.daily_energy_limit),
            allowed_start = COALESCE(EXCLUDED.allowed_start, device_policies.allowed_start),
            allowed_end = COALESCE(EXCLUDED.allowed_end, device_policies.allowed_end),
            is_enforced = COALESCE(EXCLUDED.is_enforced, device_policies.is_enforced),
            updated_at = NOW()
        RETURNING *`,
        [deviceId, dailyEnergyLimit ?? null, allowedStart ?? null, allowedEnd ?? null, isEnforced ?? null]
    )

    return rows[0]
}


//=========================================================
// DELETE
//=========================================================
export async function deleteDevice(deviceId: number): Promise<{ id: number } | null> {
    const { rows } = await pool.query(`
        UPDATE devices
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id = $1
        RETURNING id
    `, [deviceId])

    return rows[0] ?? null
}
