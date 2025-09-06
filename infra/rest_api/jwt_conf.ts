import jwt from 'jsonwebtoken'

const SECRET_KEY = "super_duper_secret"

function authenticateToken(req, res, next) {
	const authHeader = req.headers["authorization"]
	const token = authHeader && authHeader.split(" ")[1]

	if (!token) return res.sendStatus(401)

	jwt.verify(token, SECRET_KEY, (err, user) => {
		if (err) return res.sendStatus(401)
		console.log("Made it past")
		req.user = user
		next()
	})
}

export function authIfNotLocal(req, res, next) {
	const host: string = req.get("host") || ""
	const path: string = req.path

	console.log(`Host: ${host}`)
	console.log(`Path: ${path}`)

	// Have to leave these endpoints open, to assign JWT
	if (path.startsWith("/api/users/checkUserCreds") || path.startsWith("/api/users/addUser")) return next()
	// Only request that would req a JWT are external/ mobile request. 
	// Web, uses localhost ( on same network ) to hit API. Should be secure as is for web.
	if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return next()

	console.log("\nNon-local Request\n")

	return authenticateToken(req, res, next)
}

export function craft_and_set_jwt(req, res) {
	const host: string = req.get("host") || ""
	const token = jwt.sign({}, SECRET_KEY, { expiresIn: "1h" })
	if (!host.startsWith("localhost") || !host.startsWith("127.0.0.1")) {
		res.setHeader("Authorization", "Bearer " + token)
	}
}

export function verifyToken(token: string): boolean {
	try {
		const decoded = jwt.verify(token, SECRET_KEY)
		return true
	} catch (err) {
		return false
	}
}


