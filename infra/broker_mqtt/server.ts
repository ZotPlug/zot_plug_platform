import Aedes, { Client, PublishPacket } from 'aedes'
import { matches } from 'mqtt-pattern'
import net from 'net'


/* START: MQTT Broker Config & authentication */
const broker = new Aedes()
const server = net.createServer(broker.handle)
// Simple user ACL ( Replace with db in prod + hashed/radnom generated paswords )
// Create bashh script called "reg_new_plug":
// That creates a unique client code, i.e: Hard set creds before MCU flash.
// Also creates a new entry in our device db. That adds to the ACL bellow.
const users = {
	'zot_plug_000001': { password: 'secret01', allowedPublish: ['plug/plug_000001/data'], allowedSubscribe: ['plug/plug_000001/control/#'] },
	'zot_plug_000002': { password: 'secret02', allowedPublish: ['plug/plug_000002/data'], allowedSubscribe: ['plug/plug_000002/control/#'] },
	'zot_plug_000003': { password: 'secret03', allowedPublish: ['plug/plug_000003/data'], allowedSubscribe: ['plug/plug_000003/control/#'] },
	'zot_plug_000004': { password: 'secret04', allowedPublish: ['plug/plug_000004/data'], allowedSubscribe: ['plug/plug_000004/control/#'] },
	'zot_plug_000005': { password: 'secret05', allowedPublish: ['plug/plug_000005/data'], allowedSubscribe: ['plug/plug_000005/control/#'] },
	'admin': { password: 'adminpass', allowedPublish: ['#'], allowedSubscribe: ['#'] },  // full access
}

server.listen(1883, '0.0.0.0', () => {
	console.log('Aedes MQTT broker running on port 1883')
})

broker.authenticate = (client, username, password, callback) => {
	if (!username) {
		console.log('Authentication failed: Missing username')
		return callback(null, false)
	}

	const user = users[username]
	if (user && password?.toString() === user.password) {
		console.log(`Client ${username} authenticated`)
		client['username'] = username  // store username for later ACL checks
		return callback(null, true)
	}

	console.log(`Authentication failed for ${username}`)
	return callback(null, false)
}

function topicAllowed(topic: string, allowedTopics: string[]) {
	return allowedTopics.some(allowed => matches(allowed, topic))
}

broker.authorizeSubscribe = (client, sub, callback) => {
	const username = client['username']
	const user = users[username]

	if (user && topicAllowed(sub.topic, user.allowedSubscribe)) {
		return callback(null, sub)
	}
	console.log(`Subscribe denied: ${username} to topic ${sub.topic}`)
	return callback(new Error('Subscribe not allowed'))
}
/* END: MQTT Broker Config & authentication */

/* START: General Purpose MQTT functions */
const test_topic = "plug/plug_000001/control/test"
const test_payload = "Test test payload"

function publish_to_topic(topic: string, payload: string, client: Client | null) {
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

broker.on('client', (client: Client) => {
	console.log('Client connected:', client?.id)
})

broker.on('publish', (packet: PublishPacket, client: Client | null) => {
	if (client) console.log(`Recieved Packet from: ${client.id} ${packet.payload.toString()}`)
	publish_to_topic(test_topic, test_payload, client)
})
/* END: General Purpose MQTT functions */




/* Note section for broker.publish fields:
- qos (Quality of Service)
	Defines delivery guarantees for the message.

	Options:

	0 → At most once (fire-and-forget, no guarantee)

	1 → At least once (may be delivered multiple times)

	2 → Exactly once (most reliable, but more overhead)

	For simple control messages or logs, qos: 0 is typical.

- retain (Retained Message)
	If true, the broker stores the latest message on that topic.

	New subscribers to "test/control" will immediately receive this message, even if they subscribe after it was originally sent.

	If false, message is only delivered to currently connected subscribers.

- cmd (Command Type)
	Internal field in the MQTT packet structure.

	For publishes, must be "publish".

	Aedes (and other MQTT libraries) rely on this to interpret the packet type.

	You typically set this manually only when constructing raw packet objects. 

- dup (Duplicate Delivery)
	Indicates if this is a duplicate of a previous message (common in QoS 1 or 2 retransmission scenarios).

	When sending a new message, set dup: false.

	The broker might internally set dup: true if it re-delivers the message later (you don't manually control that part during re-transmits).
 */


