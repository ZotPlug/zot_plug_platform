import { broker, publish_to_topic } from './server_conf'
import { Client, PublishPacket } from 'aedes'

/* START: General Purpose MQTT functions */
const test_topic = "zot_plug_000001/cmd/test"
const test_payload = "Test test payload"

broker.on('client', (client: Client) => {
	const username = client['username']
	console.log(`Client: ${username}, connected`)
})

broker.on('publish', (packet: PublishPacket, client: Client | null) => {
	if (client) {
		console.log(`Recieved message\nTopic: ${packet.topic}\nPayload: ${packet.payload.toString()}`)
	}
	publish_to_topic({ topic: test_topic, payload: test_payload, client })
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


