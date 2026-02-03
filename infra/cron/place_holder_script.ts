// place_holder_script.ts
import { getAllUsers } from "./pg_db/queries/users";

(async function main() {
	try {
		const data = await getAllUsers();
		console.log(data)
		process.exit(0);
	} catch (e) {
		console.error("Issue with Q: " + e);
		process.exit(1);
	}
})()

