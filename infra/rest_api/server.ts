import { Request, Response } from 'express'
import { test } from '../pg_db/postgres_actions'
import { getAllUsers, getUserById, addUser } from '../pg_db/queries/users';
import { getAllDevices } from '../pg_db/queries/devices';
import app from './server_conf'

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// misc endpoints (examples)
app.post('/api/data', (req: Request, res: Response) => {
	console.log('Recieved: ', req.body)
	res.json({ message: 'Data received', yourData: req.body })
})

app.get('/api/data/query', async (req: Request, res: Response) => {
	// res.json({ message: "Query Recieved", yourData: await test() })
	try {
		const result = await test()
		res.json({ message: 'Query Recieved', yourData: result })
	} catch (err) {
		console.error('Query error:', err)
		res.status(500).json({ error: 'Failed to execute query' })
	}

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
		console.log(req.body)
		const { firstname, lastname, username, email, password } = req.body
		const userId = await addUser({ firstname, lastname, username, email, password })
		res.json({ userId })
	} catch (err) {
		console.error('Failed to add user: ', err)
		res.status(500).json({ error: `Failed to add user: ${err}` })
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
