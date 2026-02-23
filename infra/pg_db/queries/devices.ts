// infra/pg_db/queries/devices.ts
import pool from "../db_config"
import { 
    DeviceIdentifier,
    NewDevice, 
    NewReading, 
    EnergyStatsInput,
    UpdateDevice, 
    UpdateDeviceMetadata,
    UpdateDevicePolicy,
    TimeRange,
    UsageSeriesPoint,
    MostUsedDevice,
    ResolvedRange
} from "./types/types";
import { resolveDeviceId } from "./deviceResolver";
import { Buffer } from "buffer";

//=========================================================
// HELPER FUNCTIONS
//=========================================================

/**
 * Resolves and ensures a valid device ID is returned.
 * Used for updates and deletes where device must exist.
 */
async function requireDeviceId(
    deviceId?: number,
    deviceName?: string
): Promise<number> {
    const id = await resolveDeviceId(deviceId, deviceName)
    if (id === null) {
        throw new Error(`Device not found (${deviceName ?? deviceId})`)
    }
    return id
}

/**
 * Resolves time range for 24h, 7d, and 30d. 
 */
function resolveRange(range: TimeRange): ResolvedRange {
    switch (range) {
        case '24h':
            return { interval: '24 hours', periodType: 'daily' }
        case '7d':
            return { interval: '7 days', periodType: 'daily' }
        case '30d':
            return { interval: '30 days', periodType: 'daily' }
        default: {
            const _exhaustive: never = range
            throw new Error(`Invalid time range: ${_exhaustive}`)
        }
    }
}

//=========================================================
// READ
//=========================================================

/**
 * Fetch all non-deleted devices with basic info (id, name, status).
 */
export async function getAllDevices(): Promise<any[]> {
    const { rows } = await pool.query(`
        SELECT id, name, status 
        FROM devices 
        WHERE is_deleted = FALSE
        ORDER BY id
    `)

    return rows
}

/**
 * Fetch a specific device by its ID if it’s not deleted.
 */
export async function getDeviceById(deviceId: number): Promise<any | null> {
    const { rows } = await pool.query(`
        SELECT id, name, status  
        FROM devices 
        WHERE id = $1 AND is_deleted = FALSE
    `, [deviceId])

    return rows[0] ?? null
}

/**
 * Get the internal device ID by its unique name.
 */
export async function getDeviceIdByName(deviceName: string): Promise<number | null> {
    const { rows } = await pool.query(`
        SELECT id
        FROM devices
        WHERE name = $1 AND is_deleted = FALSE LIMIT 1
    `, [deviceName.trim()])

    return rows[0]?.id ?? null
}

/**
 * Fetch all devices owned or mapped to a given user (joins device + user_device_map + roles).
 */
export async function getAllDevicesByUserId(userId: number): Promise<any[]> {
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

    return rows
}

/**
 * Fetch the latest power reading for a device identified by either deviceId or deviceName.
 */
export async function getLatestReadings(identifier: DeviceIdentifier) {
    const deviceId = await resolveDeviceId( identifier.deviceId, identifier.deviceName )
    if (deviceId === null) return null

    const { rows } = await pool.query(
        `SELECT voltage, current, power, cumulative_energy, recorded_at
        FROM power_readings 
        WHERE device_id = $1 
        ORDER BY recorded_at DESC 
        LIMIT 1`,
        [deviceId]
    )
    
    return rows[0] ?? null
}

/**
 * Fetch energy statistics for a device over a specified period (daily, weekly, monthly).
 */
export async function getEnergyStats(
    identifier: DeviceIdentifier,
    periodType: 'daily'|'weekly'|'monthly',
    periodStart: string
) {
    const deviceId = await resolveDeviceId( identifier.deviceId, identifier.deviceName )
    if (deviceId === null) {
        return {
            period_type: periodType,
            period_start: periodStart,
            updated_at: null,
            total_energy: 0,
            avg_power: 0,
            max_power: 0
        }
    }

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

/**
 * Fetch all historical power readings for a device.
 */
export async function getAllReadingsPerDevice(
    identifier: DeviceIdentifier,
): Promise<any[]> {
    const deviceId = await resolveDeviceId( identifier.deviceId, identifier.deviceName )
    if (deviceId === null) return []

    const { rows } = await pool.query(
        `SELECT voltage, current, power, cumulative_energy, recorded_at
        FROM power_readings
        WHERE device_id = $1
        ORDER BY recorded_at DESC`,
        [deviceId]
    )

    return rows 
}

/**
 * Fetch power readings for a device within a specific time range (from–to ISO timestamps).
 */
export async function getReadingsInRange(
    identifier: DeviceIdentifier,
    from: string,
    to: string
): Promise<any[]> {
    const deviceId = await resolveDeviceId( identifier.deviceId, identifier.deviceName )
    if (deviceId === null) return []

    const { rows } = await pool.query(
        `SELECT voltage, current, power, cumulative_energy, recorded_at
        FROM power_readings
        WHERE device_id = $1
            AND recorded_at BETWEEN $2 AND $3
        ORDER BY recorded_at DESC`,
        [deviceId, from, to]
    )

    return rows 
}

/**
 * Fetch the active device policy (usage limits, allowed hours, etc.) for a device.
 */
export async function getDevicePolicy(
    identifier: DeviceIdentifier
) {
    const deviceId = await resolveDeviceId( identifier.deviceId, identifier.deviceName )
    if (deviceId === null) return null

    const { rows } = await pool.query(
        `SELECT daily_energy_limit, allowed_start, allowed_end, is_enforced, created_at 
        FROM device_policies 
        WHERE device_id = $1 
        LIMIT 1`, 
        [deviceId]
    )

    return rows[0] ?? null
}

/**
 * Fetch all devices currently marked as faulty (too many empty payloads, etc.).
 */
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

/**
 * Fetch time-series energy usage for a user's devices.
 * For 24h: calculate hourly energy by taking the difference betwen max and min cumulative_energy within each hour (raw data).
 * For 7d/30d: use pre-aggregated daily/weekly totals from device_energy_stats.
 */
export async function getUsageSeries(
    userId: number,         // The user whos devices to query
    range: TimeRange,       // '24h', '7d', '30d'
    deviceId?: number       // Optional: narrow to a specific device
): Promise<UsageSeriesPoint[]> {
    try {
        const { interval, periodType } = resolveRange(range)

        if (range === '24h') {
            const results = await pool.query(`
                -- 1. Create 24 hourly time buckets, guarantees exactly 24 data points, even if no readings exist for some hours. 
                WITH hours AS (
                    SELECT generate_series(
                        DATE_TRUNC('hour', NOW()) - INTERVAL '23 hours',        -- start of 24h range
                        DATE_TRUNC('hour', NOW()),                              -- end of 24h range
                        INTERVAL '1 hour'
                    ) AS bucket
                ),

                -- 2. Calculate energy used per hour. 
                -- Since devices store cumulative energy, we compute energy in each hour as: 
                -- max(cumulative_energy) - min(cumulative_energy)
                energy AS (
                    SELECT
                        DATE_TRUNC('hour', pr.recorded_at) AS bucket,
                        MAX(pr.cumulative_energy) - MIN(pr.cumulative_energy) AS energy
                    FROM power_readings pr
                    
                    -- Only include devices that belong to this user, active, and not deleted
                    JOIN user_device_map udm 
                        ON pr.device_id = udm.device_id
                        AND udm.user_id = $1
                        AND udm.status = 'active'
                    JOIN devices d
                        ON d.id = pr.device_id
                        AND d.is_deleted = FALSE
                    
                    -- Only look at last 24h of data
                    WHERE pr.recorded_at >= NOW() - INTERVAL '24 hours'
                        -- Optional filter: single device
                        AND ($2::int IS NULL OR pr.device_id = $2)
                    GROUP BY bucket
                )

                -- 3. Left join computed energy onto full 24h buckets. 
                -- If an hour has no readings, energy will be NULL, so we replace with 0 to avoid gaps in graph.
                SELECT
                    h.bucket AS timestamp,
                    COALESCE(e.energy, 0) AS value
                FROM hours h
                LEFT JOIN energy e ON h.bucket = e.bucket
                ORDER BY h.bucket ASC
            `, [userId, deviceId ?? null])

            return results.rows
        } 
        
        else {
            const { rows } = await pool.query(`
                -- 1. Generate daily buckets (7 or 30 days)
                WITH days AS (
                    SELECT generate_series(
                        CURRENT_DATE - $3::interval + INTERVAL '1 day',    -- start of range
                        CURRENT_DATE,
                        INTERVAL '1 day'
                    ) AS bucket
                ),

                -- 2. Sum energy per day from pre-aggregated stats.
                energy AS (
                    SELECT 
                        des.period_start AS bucket,

                        -- If multiple devices are included, sum their energy usage per day
                        SUM(des.total_energy) AS energy
                    FROM device_energy_stats des

                    -- Only include devices owned by this user, active, and not deleted
                    JOIN user_device_map udm
                        ON des.device_id = udm.device_id
                        AND udm.user_id = $1
                        AND udm.status = 'active'
                    JOIN devices d
                        ON d.id = des.device_id
                        AND d.is_deleted = FALSE
                    
                    WHERE des.period_type = $2
                        -- Only include periods inside requested time window
                        AND des.period_start >= CURRENT_DATE - $3::interval
                        -- Optional filter: single device
                        AND ($4::int IS NULL OR des.device_id = $4)
                    
                    GROUP BY des.period_start
                )
                
                -- 3. Left join to guarantee fixed number of buckets
                SELECT
                    d.bucket AS timestamp,
                    COALESCE(e.energy, 0) AS value
                FROM days d
                LEFT JOIN energy e ON d.bucket = e.bucket
                ORDER BY d.bucket ASC
            `, [userId, periodType, interval, deviceId ?? null])

            return rows
        }

    } catch (err) {
        console.error('Error fetching usage series:', err)
        throw err
    }
}                

/**
 * Fetch top energy-consuming devices for a user.
 * For 24h: compute energy from raw cumulative readings. 
 * For 7d/30d: sum pre-aggregated totals. 
 */
export async function getMostUsedDevices(
    userId: number,             // Only count devices belonging to this user
    range: TimeRange,
    limit: number = 5           // Max number of devices to return
): Promise<MostUsedDevice[]> {
    try {
        if (range === '24h') {
            const results = await pool.query(`
                SELECT 
                    d.id AS device_id,
                    d.name AS device_name,

                    -- Calculate energy used in last 24h for each device as:
                    MAX(pr.cumulative_energy) - MIN(pr.cumulative_energy) AS total_energy
                FROM power_readings pr

                -- Join device and user_device_map to filter only devices that belong to this user, active, and not deleted
                JOIN devices d 
                    ON d.id = pr.device_id
                    AND d.is_deleted = FALSE
                JOIN user_device_map udm 
                    ON udm.device_id = d.id
                    AND udm.user_id = $1
                    AND udm.status = 'active'
                
                -- Only consider last 24h of readings
                WHERE pr.recorded_at >= NOW() - INTERVAL '24 hours'

                -- Compute total per device, highest energy first, and limit results (5)
                GROUP BY d.id, d.name
                ORDER BY total_energy DESC
                LIMIT $2
            `, [userId, limit])

            return results.rows
        } else {
            const { interval, periodType } = resolveRange(range)

            const { rows } = await pool.query(`
                SELECT 
                    d.id AS device_id,
                    d.name AS device_name,

                    -- Sum total energy across selected time window
                    SUM(des.total_energy) AS total_energy
                FROM device_energy_stats des

                -- Only include devices owned by this user, active, and not deleted
                JOIN devices d 
                    ON d.id = des.device_id
                    AND d.is_deleted = FALSE
                JOIN user_device_map udm 
                    ON udm.device_id = d.id
                    AND udm.user_id = $1
                    AND udm.status = 'active'
                
                -- Only include periods inside requested time window
                WHERE des.period_type = $2
                    AND des.period_start >= CURRENT_DATE - $3::interval
                
                -- Aggregate energy per device, highest first, and limit results (5)
                GROUP BY d.id, d.name
                ORDER BY total_energy DESC
                LIMIT $4
            `, [userId, periodType, interval, limit])

            return rows
        }
    } catch (err) {
        console.error('Error fetching most used devices:', err)
        throw err
    }
}

//=========================================================
// CREATE
//=========================================================

/**
 * Create a new device, register it, and map it to a user as the owner (transactional).
 */
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

/**
 * Add a new power reading for a device, handling empty payloads and faulty device marking.
 */
export async function addReadings(payload: NewReading): Promise<any> {
    const { 
        deviceId: inputDeviceId, 
        deviceName, 
        voltage, 
        current, 
        power, 
        cumulativeEnergy, 
        recordedAt 
    } = payload
    
    const deviceId = await requireDeviceId(inputDeviceId, deviceName)
    
    const isEmptyPayload = 
        voltage === undefined && 
        current === undefined && 
        power === undefined && 
        cumulativeEnergy === undefined

    const recordedAtVal = recordedAt 
        ? new Date(recordedAt).toISOString() 
        : new Date().toISOString()

    // Insert values or default to zero
    const { rows } = await pool.query(`
        INSERT INTO power_readings (device_id, voltage, current, power, cumulative_energy, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`, 
        [
            deviceId, 
            voltage ?? 0, 
            current ?? 0,
            power ?? 0,
            cumulativeEnergy ?? 0,
            recordedAtVal
        ]
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
            console.warn(`[ALERT] Device ${deviceName ?? deviceId} has sent ${empty_payload_count} empty payloads!.`)
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

/**
 * Update device details like name, status, and last seen timestamp.
 */
export async function updateDevice(payload: UpdateDevice): Promise<any | null> {
    const {
        deviceId: inputDeviceId,
        deviceName,
        newDeviceName,
        status,
        lastSeen,
    } = payload
    
    const deviceId = await requireDeviceId(inputDeviceId, deviceName)

    const updates: string[] = []
    const values: (string | number)[] = []
    let idx = 1

    if (newDeviceName !== undefined) {
        updates.push(`name = $${idx++}`)
        values.push(newDeviceName)
    }

    if (status !== undefined) {
        updates.push(`status = $${idx++}`)
        values.push(status)
    }

    if (lastSeen !== undefined) {
        updates.push(`last_seen = $${idx++}`)
        values.push(lastSeen)
    }

    if (updates.length === 0) return null

    const query = `
        UPDATE devices
        SET ${updates.join(", ")}
        WHERE id = $${idx} AND is_deleted = FALSE
        RETURNING *
    `
    values.push(deviceId)

    const { rows } = await pool.query(query, values)
    return rows[0] ?? null
}

/**
 * Insert or update energy statistics for a device over a specified period.
 */
export async function upsertDeviceEnergyStats(payload: EnergyStatsInput) {
    const {
        deviceId: inputDeviceId,
        deviceName,
        periodType,
        periodStart,
        totalEnergy,
        avgPower,
        maxPower
    } = payload
    
    const deviceId = await requireDeviceId(inputDeviceId, deviceName)

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
        [
            deviceId, 
            periodType, 
            periodStart, 
            totalEnergy, 
            avgPower ?? 0, 
            maxPower ?? 0
        ]
    )

    return rows[0]
}

/**
 * Insert or update the device’s metadata (like image URL).
 */
export async function upsertDeviceImage(payload: UpdateDeviceMetadata) {
    const {
        deviceId: inputDeviceId,
        deviceName,
        imageBase64
    } = payload

    if (!imageBase64) throw new Error('imageBase64 is required')

    const deviceId = await requireDeviceId(inputDeviceId, deviceName)

    // Decode base64 image data
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    
    if (imageBuffer.length < 4) throw new Error('Invalid image data')

    const isPng = imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    const isJpeg = imageBuffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))

    if (!isPng && !isJpeg) throw new Error('Image data is not valid PNG or JPEG')

    // device_metadata is 1:1 keyed by device_id; we upsert
    const { rows } = await pool.query(
        `INSERT INTO device_metadata (device_id, image_data)
        VALUES ($1, $2)
        ON CONFLICT (device_id)
        DO UPDATE SET image_data = EXCLUDED.image_data
        RETURNING *`,
        [deviceId, imageBuffer]
    )

    return rows[0]
}

// /**
//  * Insert or update the device’s policy settings (energy limits, allowed hours, etc.).
//  */
// export async function upsertDevicePolicy(payload: UpdateDevicePolicy) {
//     const { 
//         deviceId: inputDeviceId,
//         deviceName, 
//         dailyEnergyLimit, 
//         allowedStart, 
//         allowedEnd, 
//         isEnforced 
//     } = payload

//     const deviceId = await requireDeviceId(inputDeviceId, deviceName)

//     const { rows } = await pool.query(
//         `INSERT INTO device_policies (device_id, daily_energy_limit, allowed_start, allowed_end, is_enforced, updated_at)
//         VALUES ($1, $2, $3, $4, $5, NOW())
//         ON CONFLICT (device_id)
//         DO UPDATE SET
//             daily_energy_limit = COALESCE(EXCLUDED.daily_energy_limit, device_policies.daily_energy_limit),
//             allowed_start = COALESCE(EXCLUDED.allowed_start, device_policies.allowed_start),
//             allowed_end = COALESCE(EXCLUDED.allowed_end, device_policies.allowed_end),
//             is_enforced = COALESCE(EXCLUDED.is_enforced, device_policies.is_enforced),
//             updated_at = NOW()
//         RETURNING *`,
//         [
//             deviceId, 
//             dailyEnergyLimit ?? null, 
//             allowedStart ?? null, 
//             allowedEnd ?? null, 
//             isEnforced ?? null
//         ]
//     )

//     return rows[0]
// }


//=========================================================
// DELETE
//=========================================================

/**
 * Soft-delete a device by marking it as deleted.
 */
export async function deleteDevice(
    identifier: DeviceIdentifier
): Promise<{ id: number } | null> {

    const deviceId = await requireDeviceId( identifier.deviceId, identifier.deviceName )

    const { rows } = await pool.query(`
        UPDATE devices
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id = $1
        RETURNING id
    `, [deviceId])

    return rows[0] ?? null
}
