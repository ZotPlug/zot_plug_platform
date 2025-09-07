// rest_api/jwt_config.ts
/// <reference types="node" />
import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'

const SECRET_KEY = process.env.SIGNING_KEY

if (!SECRET_KEY) {
	console.error("No signing key, in JWT_CONFIG")
	process.exit(1)
}


export function authenticateToken(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers["authorization"]
	const token = authHeader && (authHeader as string).split(" ")[1]

	if (!token) return res.sendStatus(401)

	jwt.verify(token, SECRET_KEY ?? "", (err) => {
		if (err) return res.sendStatus(401)
		next()
	})
}


export function craft_and_set_jwt(req: Request, res: Response): string {
	const token = jwt.sign({}, SECRET_KEY ?? "", { expiresIn: "1h" })

	// always set Authorization header so Postman can read it from response
	res.setHeader('Authorization', 'Bearer ' + token)

	// return so route can include it in JSON response for ease of testing
	return token
}


export function verifyToken(token: string): boolean {
	try {
		const decoded = jwt.verify(token, SECRET_KEY ?? "")
		return true
	} catch (err) {
		return false
	}
}

// update existing code to use authenticateToken
export function authIfNotLocal(req, res, next) {
	const host: string = req.get("host") || ""
	const path: string = req.path

	// keep addUser and login endpoints open
	if (path.startsWith("/api/users/checkUserCreds") || path.startsWith("/api/users") && req.method === 'POST') 
		return next()

	// Only request that would req a JWT are external/ mobile request. 
	// Web, uses localhost ( on same network ) to hit API. Should be secure as is for web.
	if (host.startsWith("api:400") || host.startsWith("localhost") || host.startsWith("127.0.0.1")) 
		return next()

	return authenticateToken(req, res, next)
}

/*
OLD WORKING VERSION

import jwt from 'jsonwebtoken'

const SECRET_KEY = process.env.SIGNING_KEY
if (!SECRET_KEY) {
	console.error("No signing key, in JWT_CONFIG")
	process.exit(1)
}

function authenticateToken(req, res, next) {
	const authHeader = req.headers["authorization"]
	const token = authHeader && authHeader.split(" ")[1]

	if (!token) return res.sendStatus(401)

	jwt.verify(token, SECRET_KEY ?? "", (err) => {
		if (err) return res.sendStatus(401)
		next()
	})
}

export function authIfNotLocal(req, res, next) {
	const host: string = req.get("host") || ""
	const path: string = req.path

	// Have to leave these endpoints open, to assign JWT
	if (path.startsWith("/api/users/checkUserCreds") || path.startsWith("/api/users/addUser")) return next()
	// Only request that would req a JWT are external/ mobile request. 
	// Web, uses localhost ( on same network ) to hit API. Should be secure as is for web.
	if (host.startsWith("api:400") || host.startsWith("localhost") || host.startsWith("127.0.0.1")) return next()

	return authenticateToken(req, res, next)
}

export function craft_and_set_jwt(req, res) {
	const host: string = req.get("host") || ""
	const token = jwt.sign({}, SECRET_KEY ?? "", { expiresIn: "1h" })
	if (!host.startsWith("localhost") || !host.startsWith("127.0.0.1")) {
		res.setHeader("Authorization", "Bearer " + token)
	}
}

export function verifyToken(token: string): boolean {
	try {
		const decoded = jwt.verify(token, SECRET_KEY ?? "")
		return true
	} catch (err) {
		return false
	}
}
*/