import express, { Request, Response } from 'express'
import { test } from '../pg_db/postgres_actions'

const app = express()
const PORT = 4000;

app.use(express.json())

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

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running on port ${PORT}`)
})
