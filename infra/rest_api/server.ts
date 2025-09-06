import { Request, Response } from 'express'
import { craft_and_set_jwt, verifyToken } from './jwt_conf'
import { getAllUsers, getUserById, addUser, createSession, checkUserCreds, getSession } from '../pg_db/queries/users'
import { getAllDevices } from '../pg_db/queries/devices'
import app from './server_conf'
import { verify } from 'argon2'

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// misc endpoints (examples)
app.post('/api/data', (req: Request, res: Response) => {
	console.log('Recieved: ', req.body)
	res.json({ message: 'Data received', yourData: req.body })
})

// user endpoints
app.get('/api/users', async (req: Request, res: Response) => {
	try {
		const users = await getAllUsers()
		res.json(users)
	} catch (err) {
		console.error('Get users error:', err)
		res.status(500).json({ error: 'Failed to fetch users' })
	}
})

app.get('/api/users/:id', async (req: Request, res: Response) => {
	try {
		const user = await getUserById(Number(req.params.id))
		res.json(user)
	} catch (err) {
		console.error('Get user by ID error:', err)
		res.status(500).json({ error: 'Failed to fetch user' })
	}
})

app.post('/api/users/addUser', async (req: Request, res: Response) => {
	try {
		const { firstname, lastname, username, email, password } = req.body
		const userId = await addUser({ firstname, lastname, username, email, password })
		craft_and_set_jwt(req, res)
		res.json(userId)

	} catch (err) {
		if (err.code === '23505') { // unique_violation
			if (err.constraint === 'users_username_key') res.status(400).json({ error: 'Username already taken' })
			if (err.constraint === 'users_email_key') res.status(400).json({ error: 'Email already registered' })

			res.status(400).json({ error: 'Duplicate value' })

		}
		res.status(500).json({ error: err })
		console.error('Failed to add user: ', err)
	}
})

app.post('/api/users/getSession', async (req: Request, res: Response) => {
	try {
		const { sessionId, userId } = await getSession({ sessionId: req.body.sessionId })
		res.json({ sessionId, userId })
	} catch (err) {
		console.error('Failed to get session from db: ', err)
		res.status(500).json({ error: `Failed to check creds: ${err}` })
	}
})

app.post('/api/users/createSession', async (req: Request, res: Response) => {
	try {
		const { userId, ip, userAgent } = req.body
		const { sessionId, minutesAlive } = await createSession({ userId, ip, userAgent })
		res.json({ sessionId, minutesAlive })
	} catch (err) {
		console.error('Failed to create session: ', err)
		res.status(500).json({ error: `Failed to create session: ${err}` })
	}
})

app.post('/api/users/checkUserCreds', async (req: Request, res: Response) => {
	try {
		const { email, password } = await req.body
		const result = await checkUserCreds({ email, password })
		craft_and_set_jwt(req, res)

		if (result.valid) {
			res.json({ "valid": true, userId: result.userId })
		} else {
			res.json({ "valid": false })
		}
	} catch (err) {
		console.error('Failed to check creds: ', err)
		res.status(500).json({ error: err })
	}
})

app.get('/api/users/checkUserJwt', async (req: Request, res: Response) => {
	try {
		console.log("Made it here")
		const authHeader = req.headers["authorization"]
		const token = authHeader && authHeader.split(" ")[1]
		if (!token) res.status(401).json({ error: "Not Authorized - No Token" })
		else if (!verifyToken(token)) res.status(401).json({ error: "Not Authorized - Invalid Token" })
		res.status(200)
	} catch (err) {
		console.error('Failed to jwt creds: ', err)
		res.status(500).json({ error: err })
	}
})

// device endpoints
app.get('/api/devices', async (req: Request, res: Response) => {
	try {
		const devices = await getAllDevices()
		res.json(devices)
	} catch (err) {
		console.error('Get devices error:', err)
		res.status(500).json({ error: 'Failed to fetch devices' })
	}
})


export default app
