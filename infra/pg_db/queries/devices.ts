// infra/pg_db/queries/devices.ts
import pool from "../db_config"
import { NewDevice, NewPowerReading, UpdateDevice } from "./types/types";

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


export async function addPowerReadingByName(payload: NewPowerReading): Promise<any> {
    const { deviceName, voltage, current, power, recordedAt } = payload
    const deviceId = await getDeviceIdByName(deviceName)

    if (!deviceId) {
        throw new Error(`Device with name ${deviceName} not found`)
    }

    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        // Determine recorded time 
        const recordedAtVal = recordedAt ? new Date(recordedAt).toISOString() : (await client.query(`SELECT NOW()`)).rows[0].now

        // Compute power if missing
        let instPower = power;
        if (instPower === undefined) {
            if (voltage !== undefined && current !== undefined) {
                instPower = voltage * current
            } else {
                throw new Error("Insufficient data to compute power reading")
            }
        }

        // Get last reading for this device and lock it to avoid concurrent races
        const { rows: lastRows } = await client.query(
        `SELECT id, cumulative_energy, recorded_at
            FROM power_readings
            WHERE device_id = $1
            ORDER BY recorded_at DESC
            LIMIT 1
            FOR UPDATE`,
            
            [deviceId]
        );

        let lastCumulative = 0;
        let lastRecordedAt: Date | null = null;
        
        if (lastRows.length > 0) {
            lastCumulative = Number(lastRows[0].cumulative_energy) || 0;
            lastRecordedAt = lastRows[0].recorded_at ? new Date(lastRows[0].recorded_at) : null;
        }

        // cCmpute time delta in hours
        let deltaHours = 0;
        const recDate = new Date(recordedAtVal);
        
        if (lastRecordedAt) {
            const ms = recDate.getTime() - lastRecordedAt.getTime();
            deltaHours = Math.max(0, ms / (1000 * 60 * 60));                    // don't allow negative (out-of-order readings)
        } else {
            // first reading: we can't compute an energy delta confidently -> assume 0 (or you may choose to approximate).
            deltaHours = 0;
        }

        const deltaEnergyWh = instPower * deltaHours;               // W * hours = Wh
        const newCumulative = lastCumulative + deltaEnergyWh;

        const insertRes = await client.query(`
            INSERT INTO power_readings (device_id, voltage, current, power, cumulative_energy, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [deviceId, voltage ?? null, current ?? null, instPower, newCumulative, recDate.toISOString()]
        );

        await client.query("COMMIT");
        return insertRes.rows[0];
    
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    
    } finally {
        client.release();
    }
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
