import pool from './db_config'

export const run = async (): Promise<void> => {
	const client = await pool.connect()
	try {
		const result = await client.query('SELECT NOW()')
		console.log('Query result:', result.rows)
	} catch (err) {
		console.error('Query error:', err)
	} finally {
		client.release()
	}
}

export const test = async (): Promise<object | null> => {
	const client = await pool.connect()
	try {
		const result = await client.query('SELECT NOW()')
		console.log('Query result:', result.rows)
		return result.rows
	} catch (err) {
		console.error('Query error:', err)
		return null
	} finally {
		client.release()
	}
}

(async function main() {
	await run()
})()

