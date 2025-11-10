// infra/pg_db/queries/users.ts
import pool from '../db_config'
import argon2 from "argon2"
import { 
    NewUser, 
    NewSession, 
    BasicCreds, 
    GetSession,
    UpdateUserFields
} from "./types/types"

//=========================================================
// READ
//=========================================================
export async function getAllUsers(): Promise<any[]> {
    const { rows } = await pool.query(`
        SELECT id, firstname, lastname, username, email, email_verified, phone
        FROM users
        WHERE is_deleted = FALSE
        ORDER BY id
    `)

    return rows
}

export async function getUserById(userId: number): Promise<any | null> {
    const { rows } = await pool.query(`
        SELECT id, firstname, lastname, username, email, email_verified, phone
        FROM users
        WHERE id = $1 AND is_deleted = FALSE
    `, [userId])

    return rows[0] ?? null
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
    const userId = rows[0]?.user_id ?? null

    if (!stored) return { valid: false, userId: null }

    try {
        const res = await argon2.verify(stored, password)
        return res ? { valid: true, userId } : { valid: false, userId: null }
    } catch {
        return { valid: false, userId: null }
    }
}

export async function getSession({ sessionId }: GetSession): Promise<{sessionId: string | null, userId: string | null}>{
    const { rows } = await pool.query<{ session_id: string, user_id: string }>(`
        SELECT session_id, user_id
        FROM user_sessions
        WHERE session_id = $1 
        LIMIT 1
        `, [sessionId])

    const session_id = rows[0]?.session_id ?? null
    const user_id = rows[0]?.user_id ?? null

    return session_id ? { sessionId: session_id, userId: user_id } : { sessionId: null, userId: null }
}



//=========================================================
// CREATE
//=========================================================
export async function addUser({ firstname, lastname, username, email, password }: NewUser): Promise<{ userId: number }> {
    const client = await pool.connect()
    try {
        await client.query("BEGIN")

        const normEmail = email.trim().toLowerCase()
        const normUsername = username.trim()

        const { rows: userRows } = await client.query<{ id: number }>(`
          INSERT INTO users (firstname, lastname, username, email)
          VALUES ($1, $2, $3, $4)
          RETURNING id
      `, [firstname.trim(), lastname.trim(), normUsername, normEmail])
        const userId = userRows[0].id

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

        // 4) record creation info - Currently setting creation_ip to NULL (implement later if needed) and manual method 
        await client.query(`
            INSERT INTO user_creation_info (user_id, creation_ip, method)
            VALUES ($1, NULL, 'manual')
        `, [userId])

        await client.query("COMMIT")
        return { userId }
    } catch (err: any) {
        await client.query("ROLLBACK")

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


//=========================================================
// UPDATE - only allowed profile fields are updated
//=========================================================
export async function updateUser(userId: number, fields: UpdateUserFields): Promise<any | null> {
    const allowed = new Set(["firstname", "lastname", "username", "email", "phone", "email_verfied"])
    const updates: string[] = []
    const values: (string | number | boolean)[] = []
    let idx = 1

    for (const [key, value] of Object.entries(fields)) {
        if (!allowed.has(key)) continue

        if (key === "email" && typeof value === "string") {
            values.push(value.trim().toLowerCase())
        
        } else if (key === "username" && typeof value === "string") {
            values.push(value.trim())

        } else {
            values.push(value as any)
        }

        updates.push(`${key} = $${idx}`)
        idx++
    }

    if (updates.length === 0) return null

    const query = `
        UPDATE users
        SET ${updates.join(", ")}
        WHERE id = $${idx} AND is_deleted = FALSE
        RETURNING *
    `

    values.push(userId)
    const { rows } = await pool.query(query, values)
    return rows[0] ?? null
}



//=========================================================
// DELETE
//=========================================================
export async function deleteUser(userId: number): Promise<{ id:number } | null> {
    const { rows } = await pool.query(`
        UPDATE users
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id = $1
        RETURNING id
    `, [userId])

    return rows[0] ?? null
}
