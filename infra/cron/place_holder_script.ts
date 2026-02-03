// place_holder_script.ts
import { getAllUsers } from "./pg_db/queries/users";

(async function main() {
	try {
		const data = await getAllUsers();
		console.log(data)
	} catch (e) {
		throw new Error("Issue with Q: " + e);
	}
})()

