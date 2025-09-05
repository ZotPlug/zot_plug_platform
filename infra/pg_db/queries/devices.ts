// all queries related to devices, device_credentials, device_metadata, device_roles, etc.
// work in progress (Need to implement CRUD)

import pool from "../db_config"
import { NewDevice, UpdateDevice } from "./types/types";


//=========================================================
// READ
//=========================================================
export async function getAllDevices() {
    const result = await pool.query(`
        SELECT * 
        FROM devices 
        WHERE is_deleted = FALSE
    `);

    return result.rows;
}

export async function getDeviceById(deviceId: number) {
    const result = await pool.query(`
        SELECT * 
        FROM devices 
        WHERE id = $1 AND is_deleted = FALSE
    `, [deviceId]);

    return result.rows[0];
}

//=========================================================
// CREATE
//=========================================================
export async function addDevice({ name, userId }: NewDevice) {
    const result = await pool.query(`
        INSERT INTO devices (name, user_id) 
        VALUES ($1, $2) 
        RETURNING *
    `, [name, userId]);

    return result.rows[0];
}

//=========================================================
// UPDATE
//=========================================================
export async function UpdateDevice({ id, name, status, powerUsage }: UpdateDevice) {
    const updates : string[] = []
    const values: (string | number | boolean)[] = []
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

    if (powerUsage !== undefined) {
        updates.push(`power_usage = $${idx}`)
        values.push(powerUsage)
        idx++
    }

    if (updates.length === 0) 
        return null

    const query = `
        UPDATE devices
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${idx} AND is_deleted = FALSE
        RETURNING *
    `

    values.push(id)

    const { rows } = await pool.query(query, values)
    return rows[0]
}


//=========================================================
// DELETE
//=========================================================
export async function deleteDevice(deviceId: number) {
    const { rows } = await pool.query(`
        UPDATE devices
        SET is_deleted = TRUE
        WHERE id = $1
        RETURNING id
    `, [deviceId])

    return rows[0]
}
