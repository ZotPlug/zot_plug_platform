import express, { Request, Response } from 'express'

const app = express()
const PORT = 3000;

app.use(express.json())

app.get('/', (req: Request, res: Response) => {
	res.send('Ello from node.js rest server!')
})

app.post('api/data', (req: Request, res: Response) => {
	console.log('Recieved: ', req.body)
	res.json({ message: 'Data received', yourData: req.body })
})

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running on port ${PORT}`)
})
