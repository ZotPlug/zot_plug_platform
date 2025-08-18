import express, { Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import pool from '../pg_db/db_config'

const PORT = 4000
const app = express()
const INTERNAL_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1']

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => INTERNAL_IPS.includes(req.ip ?? ""),
})

// Trust the proxy, and were one proxy hop from nginx
app.set('trust proxy', 1)
app.use(limiter)
app.use(express.json())

app.listen(PORT, '0.0.0.0', () => {
	console.log(`Server running on port ${PORT}`)
})

export default app
export { pool }
