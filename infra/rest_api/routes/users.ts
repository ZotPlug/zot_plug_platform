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
*               type: array
*               items:
*                 $ref: '#/components/schemas/User'
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
* /users/getUserById/{id}:
*   get:
*     summary: Get a user by a specific id.
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the user to retrieve
*     responses:
*       200:
*         description: The user was found.
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
*     summary: Add a user (signup).
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

/**
* @swagger
* /users/updateUser/{id}:
*   put:
*     summary: Update allowed user fields
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the user to update
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/User'
*     responses:
*       200:
*         description: The user was updated.
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
*         description: Invalid user id or no fields that can be updated were found.
*       404:
*         description: User not found or no change applied.
*       500:
*         description: Failed to update user.
*
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

/**
* @swagger
* /users/deleteUser/{id}:
*   delete:
*     summary: Soft deletes this user
*     tags: [Users]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the user to delete
*     responses:
*       200:
*         description: The user was deleted.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 id:
*                   type: integer
*       400:
*         description: Invalid user id.
*       404:
*         description: User not found.
*       500:
*         description: Failed to delete user.
*
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

/**
* @swagger
* /users/checkUserCreds:
*   post:
*     summary: Tries to login
*     tags: [Users]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             $ref: '#/components/schemas/Credentials'
*     responses:
*       200:
*         description: The user was created.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 valid:
*                   type: boolean
*                 userId:
*                   type: integer
*       400:
*         description: Missing email/password.
*       500:
*         description: Internal credential checking server error.
*
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
            // TODO: Switch this to error code 401.
            // Not changing at the moment because I don't don't have time to 
            // change the appropriate frontend logic right now.
            // (We don't really need custom valid parsing logic)
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

/**
* @swagger
* /users/createSession:
*   post:
*     summary: Tries to create a user session for login purposes
*     tags: [Users]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               userId:
*                 type: integer
*               ip:
*                 type: string
*               userAgent:
*                 type: string
*     responses:
*       200:
*         description: The session was created.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 sessionId:
*                   type: string
*                 minutesAlive:
*                   type: integer
*               example:
*                 userId: 4
*                 ip: "127.0.0.1"
*                 userAgent: "Windows"
*       400:
*         description: Missing user ID.
*       500:
*         description: Failed to create user session.
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

/**
* @swagger
* /users/getSession:
*   post:
*     summary: Tries to get an existing a user session for login purposes
*     tags: [Users]
*     requestBody:
*       required: true
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               sessionId:
*                 type: string
*     responses:
*       200:
*         description: The session was created.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 sessionId:
*                   type: string
*                 userId:
*                   type: integer
*       400:
*         description: Missing session ID.
*       500:
*         description: Failed to get session from database and failed to check credentials.
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

/**
* @swagger
* /users/checkUserJwt:
*   post:
*     summary: Tries to verify the token in the authorization header
*     tags: [Users]
*     parameters:
*       - name: token
*         in: header
*         description: The JWT token used for authorization purposes.
*         required: true
*         type: string
*     responses:
*       200:
*         description: The token was verified
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 ok:
*                   type: boolean
*       401:
*         description: Not authorized. NO token or token is invalid.
*       500:
*         description: Failed to get jwt credentials.
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
