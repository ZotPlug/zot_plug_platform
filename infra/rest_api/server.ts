import { Request, Response } from 'express'
import app from './server_conf'
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
