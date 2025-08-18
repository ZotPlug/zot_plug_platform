// all queries related to devices, device_credentials, device_metadata, device_roles, etc.
// work in progress (Need to implement CRUD)

import { pool } from "../server_conf";

// Get all devices 
export async function getAllDevices() {
    const result = await pool.query(
        'SELECT * FROM devices WHERE is_deleted = FALSE'
    );

    return result.rows;
}

// Get a device by ID 
export async function getDeviceById(deviceId: number) {
    const result = await pool.query(
        'SELECT * FROM devices WHERE id = $1 AND is_deleted = FALSE',
        [deviceId]
    );

    return result.rows[0];
}

// Add a new device 
export async function addDevice(name: string) {
    const result = await pool.query(
        'INSERT INTO devices (name) VALUES ($1) RETURNING id',
        [name]
    );

    return result.rows[0];
}