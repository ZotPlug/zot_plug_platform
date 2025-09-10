// rest_api/server.ts
import { Request, Response } from 'express'
import app from './server_conf'
import usersRouter from './routes/users'
import devicesRouter from './routes/devices'
import { authIfNotLocal } from './jwt_conf'

// apply authIfNotLocal 
// allows local requests and opens signup/login
app.use(authIfNotLocal)

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// test misc endpoint
app.post('/api/data', (req: Request, res: Response) => {
	console.log('Recieved: ', req.body)
	res.json({ message: 'Data received', yourData: req.body })
})

// mount resource routers
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)

export default app

