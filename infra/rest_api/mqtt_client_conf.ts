import mqtt, { IClientOptions, MqttClient } from 'mqtt'

let client: MqttClient | null = null
let reconnectAttempts = 0
let maxReconnectAttempts = 5

export function getMqttClient(): MqttClient {

	if (client) return client;

	const url = process.env.MQTT_URL ?? "mqtt://broker:1883";
	const opts: IClientOptions = {
		username: 'api',
		password: 'apipass',
		reconnectPeriod: 1000,         // 1s backoff
		connectTimeout: 10_000,
		// offline queue behavior:
		queueQoSZero: true,            // buffer QoS0 while offline
		clean: true,                   // typical for clients that reconnect
	};

	client = mqtt.connect(url, opts);

	client.on("connect", () => console.log("[mqtt] connected"));
	client.on("reconnect", () => {
		if (reconnectAttempts >= maxReconnectAttempts) {
			reconnectAttempts = 0
			client?.end(true)
			console.log("[mqtt] max reconnectAttempts")
		}
		else ++reconnectAttempts
	});
	client.on("close", () => console.log("[mqtt] closed"));
	client.on("error", (err) => console.error("[mqtt] error:", err.message));

	// graceful shutdown in Docker
	const shutdown = () => client?.end(true, () => process.exit(0));
	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	return client;
}

// Promise helper to await PUBACK for QoS1
export function publishAsync(topic: string, payload: Buffer | string, qos: 0 | 1 = 0, retain = false) {
	const c = getMqttClient();
	return new Promise<void>((resolve, reject) => {
		c.publish(topic, payload, { qos, retain }, (err?: Error) => {
			if (err) return reject(err);
			resolve();
		});
	});
}
