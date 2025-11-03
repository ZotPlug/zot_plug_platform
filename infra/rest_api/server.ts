// rest_api/server.ts
import { Request, Response } from "express"
import app from './server_conf'
import usersRouter from './routes/users'
import devicesRouter from './routes/devices'
import mqttRouter from './routes/mqtt'

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// test misc endpoint
app.post('/api/test', (req: Request, res: Response) => {
	res.json({ message: 'Data received, from test endpoint', yourData: req.body })
})

// mount resource routers
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/mqtt', mqttRouter)

export default app

