// all queries related to users, user_sessions, user_device_map, etc
// work in progress (Need to implement CRUD)

import pool from '../db_config'

// Get all users
export async function getAllUsers() {
    const result = await pool.query(`
        SELECT id, firstname, lastname, username, email, email_verified, phone
        FROM users
        WHERE is_deleted = FALSE
    `);

    return result.rows;
}

// Get a single user by ID
export async function getUserById(userId: number){
    const result = await pool.query(`
        SELECT *
        FROM users
        WHERE id = $1 AND is_deleted = FALSE
    `, [userId]);

    return result.rows[0];
}

// Add a new user 
export async function addUser(firstname: string, lastname: string, username: string, email: string) {
    const result = await pool.query(`
        INSERT INTO users (firstname, lastname, username, email)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [firstname, lastname, username, email]);
     
    return result.rows[0];
}
