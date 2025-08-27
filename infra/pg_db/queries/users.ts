// all queries related to users, user_sessions, user_device_map, etc
// work in progress (Need to implement CRUD)
import pool from '../db_config'
import argon2 from "argon2"
import { NewUser, NewSession, BasicCreds, GetSession } from "./types/types"

export async function getAllUsers() {
    const result = await pool.query(`
        SELECT id, firstname, lastname, username, email, email_verified, phone
        FROM users
        WHERE is_deleted = FALSE
    `)

    return result.rows
}

export async function getUserById(userId: number) {
    const result = await pool.query(`
        SELECT *
        FROM users
        WHERE id = $1 AND is_deleted = FALSE
    `, [userId])

    return result.rows[0]
}

export async function checkUserCreds({ email, password }: BasicCreds): Promise<{ valid: boolean, userId: string | null }> {
    const normEmail = email.trim().toLowerCase()
    const { rows } = await pool.query<{ password_hash: string, user_id: string }>(`
        SELECT ac.password_hash, ac.user_id
        FROM users u
        JOIN auth_credentials ac ON ac.user_id = u.id
        WHERE u.email = $1 AND u.is_deleted = FALSE
        LIMIT 1
    `, [normEmail])

    const stored = rows[0]?.password_hash
    const userId = rows[0]?.user_id

    if (!stored) return { valid: false, userId: null }

    try {
        const res = await argon2.verify(stored, password)
        return res ? { valid: true, userId: userId } : { valid: false, userId: null }
    } catch {
        return { valid: false, userId: null }
    }
}

export async function addUser({ firstname, lastname, username, email, password }: NewUser): Promise<{ id: number }> {
    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        const normEmail = email.trim().toLowerCase()
        const normUsername = username.trim()

        const { rows } = await client.query<{ id: number }>(`
          INSERT INTO users (firstname, lastname, username, email)
          VALUES ($1, $2, $3, $4)
          RETURNING id
      `, [firstname.trim(), lastname.trim(), normUsername, normEmail])
        const userId = rows[0].id

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
    const { rows } = await pool.query<{
        session_id: string;
        minutes_alive: number;
    }>(
        `
    INSERT INTO user_sessions (user_id, expires_at, ip_address, user_agent)
    VALUES ($1, NOW() + interval '12 hours', $2, $3)
    RETURNING 
      session_id,
      EXTRACT(EPOCH FROM (expires_at - created_at)) / 60 AS minutes_alive
    `,
        [userId, ip, userAgent]
    )

    return {
        sessionId: rows[0].session_id,
        minutesAlive: Number(rows[0].minutes_alive),
    }
}

export async function getSession({ sessionId }: GetSession) {
    const { rows } = await pool.query<{ session_id: string, user_id: string }>(`
        SELECT session_id, user_id
        FROM user_sessions
        WHERE session_id = $1 
        LIMIT 1
        `, [sessionId])

    const session_id = rows[0]?.session_id
    const user_id = rows[0]?.user_id

    return session_id ? { sessionId: session_id, userId: user_id } : { sessionId: null, userId: null }
}

