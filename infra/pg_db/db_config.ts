import { Pool } from 'pg';

// Configure your pool
const pool = new Pool({
	host: 'postgres',          // Docker service name
	port: 5432,
	user: 'myuser',
	password: 'mypassword',
	database: 'mydb',
	max: 10,                    // Optional: max connections
	idleTimeoutMillis: 30000,  // Optional: timeout for idle clients
});

export default pool;

