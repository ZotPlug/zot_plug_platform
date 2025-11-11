/**
* @swagger
* components:
*   schemas:
*     User:
*       type: object
*       required:
*         - firstname
*         - lastname
*         - username
*         - email
*       properties:
*         id:
*           type: string
*           description: The auto-generated id of the user
*         firstname:
*           type: string
*           description: The user's first name
*         lastname:
*           type: string
*           description: The user's last name
*         username:
*           type: string
*           description: Login/display name (unique)
*         email:
*           type: string
*           description: Unique email (for login/auth or notifications)
*         email_verified:
*           type: boolean
*           description: Email verification (auth security)
*         phone:
*           type: string
*           description: Optional phone number
*         is_deleted:
*           type: boolean
*           description: Soft-delete flag (true if account is removed)
*         deleted_at:
*           type: string
*           format: date
*           description: Timestamp when user was soft-deleted
*       example:
*         id: 12
*         firstname: Bob
*         lastname: Jones
*         username: bobjonesman
*         email: bobjones@gmail.com
*         email_verified: true
*         is_deleted: true
*         deleted_at: 2020-03-10T04:05:06.157Z
*/

// infra/rest_api/routes/users.ts
import { Router, Request, Response } from 'express'
import {
    getAllUsers,
    getUserById,
    addUser, 
    createSession,
    checkUserCreds,
    getSession,
    updateUser,
    deleteUser
} from '../../pg_db/queries/users'
import { craft_and_set_jwt, verifyToken } from '../jwt_conf'

const router = Router()

/**
* @swagger
* tags:
*   name: Users
*   description: The user management API.
* /users/getAllUsers:
*   get:
*     summary: Get all users whose accounts haven't been deleted
*     tags: [Users]
*     responses:
*       200:
*         description: The returned users sorted by ID.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/User'
*       500:
*         description: Failed to fetch users.
*
*/
router.get('/getAllUsers', async (req: Request, res: Response) => {
    try {
        const users = await getAllUsers()
        res.json(users)

    } catch (err) {
        console.error('Get users error: ', err)
        res.status(500).json({ error: 'Failed to fetch users'})
    }
})

/**
 * GET /api/users/getUserById/:id - get user_id
 */

/**
* @swagger
* /users/getUserById/:id:
*   get:
*     summary: Get a user by a specific id.
*     tags: [Users]
*     responses:
*       200:
*         description: The specific user.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/User'
*       400:
*         description: Invalid user id.
*       404:
*         description: User not found.
*       500:
*         description: Failed to fetch user.
*/
router.get('/getUserById/:id', async (req: Request, res: Response) => {
	try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id'})

        const user = await getUserById(id)
        if (!user) return res.status(404).json({ error: 'User not found' })

        res.json(user)
    
	} catch (err) {
		console.error('Get user by ID error:', err)
		res.status(500).json({ error: 'Failed to fetch user' })
	}
})

/**
 * POST /api/users/addUser - create user (signup)
 * returns userId and token 
 */

/**
* @swagger
* /users/addUser:
*   post:
*     summary: Add a user.
*     tags: [Users]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/User'
*     responses:
*       201:
*         description: The user was created.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 userId:
*                   type: integer
*                 token:
*                   type: string
*       400:
*         description: Missing required fields or duplicate value.
*       500:
*         description: Failed to add user.
*
*/
router.post('/addUser', async (req: Request, res: Response) => {
	try {
		const { firstname, lastname, username, email, password } = req.body
        if (!firstname || !lastname || !username || !email || !password) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

		const result = await addUser({ firstname, lastname, username, email, password })
		
        // craft token and set header
        // also include token in response for Postman API testing
        const token = craft_and_set_jwt(req, res)
		res.status(201).json({ userId: result.userId, token })

	} catch (err) {
		if (err?.code === '23505') { // unique_violation
			if (err.constraint === 'users_username_key') res.status(409).json({ error: 'Username already taken' })
			if (err.constraint === 'users_email_key') res.status(409).json({ error: 'Email already registered' })

			return res.status(400).json({ error: 'Duplicate value' })
		}

		console.error('Failed to add user: ', err)
        res.status(500).json({ error: err })
	}
})

/**
 * PUT /api/users/updateUser/:id - update allowed fields
 */
router.put('/updateUser/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const allowed = ['firstname', 'lastname', 'username', 'email', 'phone', 'email_verified']
        const payload: any = {}

        for (const k of allowed) {
            if (req.body[k] !== undefined) payload[k] = req.body[k]
        }

        if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No updatable fields provided' })

        const updated = await updateUser(id, payload)
        if (!updated) return res.status(404).json({ error: 'User not found or no changed applied' })

        res.json(updated)

    } catch (err) {
        console.error('Update user error:', err)
        res.status(500).json({ error: 'Failed to update user' })

    }
})

/**
 * DELETE /api/users/deleteUser/:id - soft delete
 */
router.delete('/deleteUser/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const deleted = await deleteUser(id)
        if (!deleted) return res.status(404).json({ error: 'User not found' })

        res.json(deleted)

    } catch (err) {
        console.error("Delete user error:", err)
        res.status(500).json({ error: 'Failed to delete user' })

    }
})


/**
 * POST /api/users/checkUserCreds - login
 */
router.post('/checkUserCreds', async (req: Request, res: Response) => {
	try {
		const { email, password } = await req.body
        if (!email || !password) {
            return res.status(400).json({ error: 'Missing email/password' })
        }

		const result = await checkUserCreds({ email, password })

		if (result.valid) {
            const token = craft_and_set_jwt(req, res)
			return res.json({ "valid": true, userId: result.userId })
		} else {
			return res.json({ "valid": false })
		}

	} catch (err) {
		console.error('Failed to check creds: ', err)
		res.status(500).json({ error: err })
	}
})

/**
 * POST /api/users/createSession
 */
router.post('/createSession', async (req: Request, res: Response) => {
    try {
        const { userId, ip, userAgent } = req.body
        if (!userId) return res.status(400).json({ error: 'Missing userId' })

        const { sessionId, minutesAlive } = await createSession({ userId, ip: ip ?? null, userAgent: userAgent ?? null })
        res.json({ sessionId, minutesAlive })

    } catch (err) {
        console.error('Failed to create sessions: ', err)
        res.status(500).json({ error: `Failed to create session ${err}` })
    }
})


/**
 * POST /api/users/getSession
 */
router.post('/getSession', async (req: Request, res: Response) => {
	try {
		const { sessionId } = req.body
        if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

        const sess = await getSession({ sessionId })
        res.json(sess)
        
	} catch (err) {
		console.error('Failed to get session from db: ', err)
		res.status(500).json({ error: `Failed to check creds: ${err}` })
	}
})


/**
 * POST /api/users/checkUserJwt - verify token in Authorization header
 */
router.post('/checkUserJwt', async (req: Request, res: Response) => {
	try {
		const authHeader = req.headers["authorization"]
		const token = authHeader && authHeader.split(" ")[1]
		if (!token) return res.status(401).json({ error: "Not Authorized - No Token" })
		
		if (!verifyToken(token)) return res.status(401).json({ error: "Not Authorized - Invalid Token" })
		res.status(200).json({ ok: true })

	} catch (err) {
		console.error('Failed to jwt creds: ', err)
		res.status(500).json({ error: err })
	}
})

export default router
