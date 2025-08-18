import { Request, Response } from 'express'
import app, { pool }from './server_conf'
import { test } from '../pg_db/postgres_actions'

app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

app.post('/api/data', (req: Request, res: Response) => {
	console.log('Recieved: ', req.body)
	res.json({ message: 'Data received', yourData: req.body })
})

app.get('/api/data/query', async (req: Request, res: Response) => {
	res.json({ message: "Query Recieved", yourData: await test() })
})

app.get('/api/test-db', async (req: Request, res: Response) => {
	try {
		const result = await pool.query('SELECT NOW()');							// Simple test query
		res.json({message: 'Database connected!', time: result.rows[0].now });
	
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Database connection failed' });
		
	}
})
