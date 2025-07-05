import { Client } from 'pg';

const client = new Client({
	host: 'localhost',
	port: 5432,
	user: 'myuser',
	password: 'mypassword',
	database: 'mydb',
});

const run = async (): Promise<void> => {
	try {
		await client.connect();
		console.log('Connected to Postgres!');

		const res = await client.query('SELECT NOW()');
		console.log(res.rows);
	} catch (err) {
		console.error('Connection error', err);
	} finally {
		await client.end();
	}
};

run();

