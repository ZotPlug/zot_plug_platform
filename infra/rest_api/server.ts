// rest_api/server.ts
import express, { Request, Response, NextFunction, RequestHandler } from "express"
import { publishAsync } from './mqtt_client_conf'
import app from './server_conf'
import usersRouter from './routes/users'
import devicesRouter from './routes/devices'

// root route
app.get('/', (req: Request, res: Response) => {
	res.json({ message: 'Ello from node.js rest server!' })
})

// test misc endpoint
app.post('/api/test', (req: Request, res: Response) => {
	res.json({ message: 'Data received, from test endpoint', yourData: req.body })
})

const ALLOW = new Set(["devices/cmd", "alerts", "test/topic"])

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
	(req, res, next) => { fn(req, res, next).catch(next); }

type PublishBody = {
	topic: string;
	payload?: unknown;
	qos?: 0 | 1;
	retain?: boolean;
}

app.post("/mqtt/publish", asyncHandler(async (
	req: Request<{}, any, PublishBody>,
	res: Response
): Promise<void> => {
	const { topic, payload, qos = 0, retain = false } = req.body ?? {};
	if (!topic) { res.status(400).json({ error: "topic required" }); return; }
	if (!ALLOW.has(topic)) { res.status(403).json({ error: "topic not allowed" }); return; }

	const body = typeof payload === "object" ? JSON.stringify(payload) : String(payload ?? "");
	await publishAsync(topic, body, qos === 1 ? 1 : 0, !!retain);

	// IMPORTANT: don’t `return res.json(...)` — just send and end the function (Promise<void>)
	res.json({ ok: true });
}));

// mount resource routers
app.use('/api/users', usersRouter)
app.use('/api/devices', devicesRouter)

export default app

