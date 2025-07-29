import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();						// Load from .env

// Configure your pool
const pool = new Pool({
	host: process.env.PG_HOST,          // Docker service name
	port: process.env.PG_PORT,
	user: process.env.PG_USER,
	password: process.env.PG_PASSWORD,
	database: process.env.PG_DATABASE,
	max: 10,                    // Optional: max connections
	idleTimeoutMillis: 30000,  // Optional: timeout for idle clients
});

export default pool;
