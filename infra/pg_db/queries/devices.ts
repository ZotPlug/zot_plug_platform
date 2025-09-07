// all queries related to devices, device_credentials, device_metadata, device_roles, etc.
// work in progress (Need to implement CRUD)

import pool from "../db_config"
import { NewDevice, UpdateDevice } from "./types/types";


//=========================================================
// READ
//=========================================================
export async function getAllDevices(): Promise<any[]> {
    const { rows } = await pool.query(`
        SELECT * 
        FROM devices 
        WHERE is_deleted = FALSE
        ORDER BY id
    `)

    return rows
}

export async function getDeviceById(deviceId: number): Promise<any | null> {
    const { rows } = await pool.query(`
        SELECT * 
        FROM devices 
        WHERE id = $1 AND is_deleted = FALSE
    `, [deviceId])

    return rows[0] ?? null
}

//=========================================================
// CREATE
//=========================================================
export async function addDevice({ name, userId }: NewDevice): Promise<any> {
    // we want to insert into devices and user_device_map atomically
    // so we do this in a transaction

    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        const { rows: deviceRows } = await client.query<{ id: number }>(`
            INSERT INTO devices (name)
            VALUES ($1)
            RETURNING id, name, status, last_seen
        `, [name.trim()])

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
            const { rows: newRoleRows } = await client.query<{ id: number}>(`
                INSERT INTO devices_roles (role, description) 
                VALUES ("owner', 'Device owner')
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

//=========================================================
// UPDATE
//=========================================================
export async function updateDevice({ id, name, status, lastSeen }: UpdateDevice): Promise<any | null> {
    const updates : string[] = []
    const values: (string | number )[] = []
    let idx = 1

    if (name !== undefined) {
        updates.push(`name = $${idx}`)
        values.push(name)
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
