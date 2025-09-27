import mqtt, { IClientOptions, MqttClient } from 'mqtt'
import { matches } from 'mqtt-pattern'

let client: MqttClient | null = null
let reconnectAttempts = 0
let maxReconnectAttempts = 5
const ALLOW: string[] = ["+/data", "+/control/#"]
const c = getMqttClient()

export function topicAllowed(topic: string) {
	return ALLOW.some(allowed => matches(allowed, topic))
}

export function getMqttClient(): MqttClient {
	if (client) return client
	const url = process.env.MQTT_URL ?? "mqtt://broker:1883"
	const opts: IClientOptions = {
		username: 'api',
		password: 'apipass',
		reconnectPeriod: 1000,         // 1s backoff
		connectTimeout: 10_000,
		// offline queue behavior:
		queueQoSZero: true,            // buffer QoS0 while offline
		clean: true,                   // typical for clients that reconnect
	}

	client = mqtt.connect(url, opts)

	client.on("connect", () => {
		if (client) {
			client.subscribe("+/data", (err) => {
				if (err) console.error('Subscribe failed: ', err)
			}) // Sub to all topics. I.e: All messages going to broker, will also be avail in the rest api.
			console.log("[mqtt] connected")
		}
	})

	client.on("reconnect", () => {
		if (reconnectAttempts >= maxReconnectAttempts) {
			reconnectAttempts = 0
			client?.end(true)
			console.log("[mqtt] max reconnectAttempts")
		}
		else ++reconnectAttempts
	})
	client.on('message', (topic, payload, packet) => {
		console.log("Recieved Message")
		console.log("Topic: ", topic)
		console.log("Payload: ", payload.toString())
	})
	client.on("close", () => console.log("[mqtt] closed"))
	client.on("error", (err) => console.error("[mqtt] error:", err.message))
	// graceful shutdown in Docker
	const shutdown = () => client?.end(true, () => process.exit(0))
	process.on("SIGTERM", shutdown)
	process.on("SIGINT", shutdown)
	return client
}

// Promise helper to await PUBACK for QoS1
export function publishAsync(topic: string, payload: Buffer | string, qos: 0 | 1 = 0, retain = false) {
	return new Promise<void>((resolve, reject) => {
		c.publish(topic, payload, { qos, retain }, (err?: Error) => {
			if (err) return reject(err)
			resolve()
		})
	})
}
