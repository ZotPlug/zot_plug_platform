// all queries related to users, user_sessions, user_device_map, etc
// work in progress (Need to implement CRUD)
import pool from '../db_config'
import argon2 from "argon2"
import { NewUser, NewSession } from "./types/types"

// Get all users
export async function getAllUsers() {
    const result = await pool.query(`
        SELECT id, firstname, lastname, username, email, email_verified, phone
        FROM users
        WHERE is_deleted = FALSE
    `)

    return result.rows
}

// Get a single user by ID
export async function getUserById(userId: number) {
    const result = await pool.query(`
        SELECT *
        FROM users
        WHERE id = $1 AND is_deleted = FALSE
    `, [userId])

    return result.rows[0]
}

// Create user + password atomically
export async function addUser({ firstname, lastname, username, email, password }: NewUser): Promise<{ id: number }> {
    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        // Normalize inputs (helps with uniqueness)
        const normEmail = email.trim().toLowerCase()
        const normUsername = username.trim()

        // 1) Create the user profile
        const { rows } = await client.query<{ id: number }>(`
          INSERT INTO users (firstname, lastname, username, email)
          VALUES ($1, $2, $3, $4)
          RETURNING id
      `, [firstname.trim(), lastname.trim(), normUsername, normEmail])
        const userId = rows[0].id

        // 2) Hash the password (Argon2id)
        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
            timeCost: 3,          // increase if your server can handle it
            memoryCost: 1 << 15,  // 32 MB tune for your infra
            parallelism: 1,
        })

        // 3) Store auth credentials
        await client.query(`
          INSERT INTO auth_credentials (user_id, password_hash)
          VALUES ($1, $2)
      `, [userId, passwordHash])

        await client.query("COMMIT")
        return { id: userId }
    } catch (err: any) {
        await client.query("ROLLBACK")

        // Helpful unique-constraint error mapping
        if (err?.code === "23505") {
            // You can inspect err.detail to see which constraint hit
            if (String(err.detail || "").includes("(username)")) {
                throw new Error("Username already exists")
            }
            if (String(err.detail || "").includes("(email)")) {
                throw new Error("Email already exists")
            }
        }
        throw err
    } finally {
        client.release()
    }
}

export async function createSession({ userId, ip, userAgent }: NewSession) {
    const { rows } = await pool.query<{ session_id: string }>(`
        INSERT INTO user_sessions (user_id, expires_at, ip_address, user_agent)
        VALUES ($1, NOW() + interval '24 hours', $2, $3)
        RETURNING session_id`
        , [userId, ip, userAgent])

    return rows[0].session_id
}

