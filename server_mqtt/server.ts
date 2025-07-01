import Aedes, { Client, PublishPacket } from 'aedes';
import net from 'net';

const broker = new Aedes();

const server = net.createServer(broker.handle);

server.listen(1883, '0.0.0.0', () => {
	console.log('Aedes MQTT broker running on port 1883');
});

broker.on('client', (client: Client) => {
	console.log('Client connected:', client?.id);
});

broker.on('publish', (packet: PublishPacket, client: Client | null) => {
	console.log(`Message on ${packet.topic}: ${packet.payload.toString()}`);
});

