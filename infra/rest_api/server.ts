import { Request, Response } from 'express'
import app, { pool } from './server_conf'
import { test } from '../pg_db/postgres_actions'
import * as userQueries from './queries/user'
import * as deviceQueries from './queries/devices'

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// test database connection
app.get('/api/test-db', async (req: Request, res: Response) => {
	try {
		const result = await pool.query('SELECT NOW()');							
		res.json({message: 'Database connected!', time: result.rows[0].now });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database connection failed' });
	}
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
		const users = await userQueries.getAllUsers()
		res.json(users)
	} catch (err) {
		console.error('Get users error:', err)
        res.status(500).json({ error: 'Failed to fetch users' })
	}
})

app.get('/api/users/:id', async (req: Request, res: Response) => {
	try {
		const user = await userQueries.getUserById(Number(req.params.id))
		res.json(user)
	} catch (err) {
		console.error('Get user by ID error:', err)
        res.status(500).json({ error: 'Failed to fetch user' })
	}

})

app.post('/api/users', async (req: Request, res: Response) => {
	try {
		const { firstname, lastname, username, email } = req.body
		const newUser = await userQueries.addUser(firstname, lastname, username, email)
		res.json(newUser)
	} catch (err) {
		console.error('Add user error:', err)
        res.status(500).json({ error: 'Failed to add user' })
	}
})

// device endpoints
app.get('/api/devices', async (req: Request, res: Response) => {
	try {
		const devices = await deviceQueries.getAllDevices()
		res.json(devices)
	} catch (err) {
		console.error('Get devices error:', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
	}
})

export default app
