import Aedes, { Client, PublishPacket } from 'aedes'
import { matches } from 'mqtt-pattern'
import net from 'net'
import { Record } from 'openai/internal/builtin-types'

export const broker = new Aedes()
const server = net.createServer(broker.handle)

server.listen(1883, '0.0.0.0', () => {
	console.log('Aedes MQTT broker running on port 1883')
})
/* START: MQTT Broker Config & authentication */
// Simple user ACL ( Replace with db in prod + hashed/radnom generated paswords )
// Create bashh script called "reg_new_plug"
// That creates a unique client code, i.e: Hard set creds before MCU flash.
// Also creates a new entry in our device db. That adds to the ACL bellow.
const clients = {
	'zot_plug_000001': { password: 'secret01', allowedPublish: ['zot_plug_000001/data'], allowedSubscribe: ['zot_plug_000001/cmd/#'] },
	'zot_plug_000002': { password: 'secret02', allowedPublish: ['zot_plug_000002/data'], allowedSubscribe: ['zot_plug_000002/cmd/#'] },
	'zot_plug_000003': { password: 'secret03', allowedPublish: ['zot_plug_000003/data'], allowedSubscribe: ['zot_plug_000003/cmd/#'] },
	'zot_plug_000004': { password: 'secret04', allowedPublish: ['zot_plug_000004/data'], allowedSubscribe: ['zot_plug_000004/cmd/#'] },
	'zot_plug_000005': { password: 'secret05', allowedPublish: ['zot_plug_000005/data'], allowedSubscribe: ['zot_plug_000005/cmd/#'] },
	'api': { password: 'apipass', allowedPublish: ['+/cmd/#'], allowedSubscribe: ['+/data'] },
	'admin': { password: 'adminpass', allowedPublish: ['#'], allowedSubscribe: ['#'] },  // full access
}

function topicAllowed(topic: string, allowedTopics: string[]) {
	return allowedTopics.some(allowed => matches(allowed, topic))
}

broker.authenticate = (client, username, password, callback) => {
	if (!username) {
		console.log('Authentication failed: Missing username')
		return callback(null, false)
	}

	const user = clients[username]
	if (user && password?.toString() === user.password) {
		console.log(`Client: ${username}, authenticated`)
		client['username'] = username  // store username for later ACL checks
		return callback(null, true)
	}

	console.log(`Authentication failed for ${username}`)
	return callback(null, false)
}

broker.authorizePublish = (client, packet, callback) => {
	const username = client ? client['username'] : null
	const user = clients[username]

	if (user && topicAllowed(packet.topic, user.allowedPublish)) {
		// You can also mutate the packet (e.g., enforce retain=false)
		// packet.retain = false
		return callback(null)
	}

	console.log(`Publish denied: ${username ?? "unknown"} to ${packet.topic}`)
	return callback(new Error("Publish not allowed"))
}

broker.authorizeSubscribe = (client, sub, callback) => {
	const username = client['username']
	const user = clients[username]

	if (user && topicAllowed(sub.topic, user.allowedSubscribe)) {
		return callback(null, sub)
	}
	console.log(`Subscribe denied: ${username} to topic ${sub.topic}`)
	return callback(new Error('Subscribe not allowed'))
}
/* END: MQTT Broker Config & authentication */
type publish_req = {
	topic: string,
	payload: string,
	client: Client | null
}
export function publish_to_topic({ topic, payload, client }: publish_req) {
	if (client) {
		setTimeout(() => { }, 2000)
		broker.publish({
			topic,
			payload: Buffer.from(payload),
			qos: 0,
			retain: false,
			cmd: 'publish',
			dup: false
		}, (err) => {
			if (err) console.error('Error publishing: ', err)
		})
	}
}

