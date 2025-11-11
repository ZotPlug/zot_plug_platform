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

// Setup Swagger API documentation
const express = require("express")
const bodyParser = require("body-parser")
const swaggerJsdoc = require("swagger-jsdoc")
const swaggerUi = require("swagger-ui-express")

const swaggerOptions = {
    definition: {
        openapi: "3.1.0",
        info: {
            title: "ZotPlug Backend API (Express.js)",
            version: "0.1.0",
            description: "This is the CRUD API backend for the Zotplug software.",
        },
        servers: [
            {
                url: "http://localhost:4000/api",
            }
        ],
    },
    apis: [
        "./routes/*.ts",
    ],
}

const swaggerJsdocSpecs = swaggerJsdoc(swaggerOptions)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerJsdocSpecs, { explorer: true }))

// mount resource routers
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/mqtt', mqttRouter)

export default app

