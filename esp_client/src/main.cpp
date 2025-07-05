#include "../main.h"
#include "config.h"
#include <WiFi.h>
#include <Arduino.h>
#include <PubSubClient.h>

/* Network Config */
const char* ssid = "YOUR_WIFI_USER";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server = "YOUR_LOCAL/PUB_IP";

/* Client Config */
const char* client_id = "zot_plug_000001";
const char* client_user = "zot_plug_000001";
const char* client_pass =  "secret01";
const char* client_subscribe_topic = "plug/plug_000001/control/#";
const char* client_publish_topic = "plug/plug_000001/data";

/* Global Pin Config */
const int ledPin_external = 22;
const int ledPin_internal = 2;
const int button_input = 23;

/* Global Flags */
volatile boolean message_recieved = false;

// When the server sends a message to this device. Via "client_subscribe_topic", decide what to do with it here.// The topic is wildcarded "#". Meaning that anything past "/control/", is a string you can check.
void fn_on_message_received(char* topic, byte* payload, unsigned int length ){
	if (val_incoming_topic(topic, client_subscribe_topic)) {
		Serial.println("Message received");
		Serial.print("Payload: ");
		for (unsigned int i = 0; i < length; i++) {
		  Serial.print((char)payload[i]);
		}
		Serial.println();
		message_recieved = true;
	}
}

// MQTT Task: Assigned to core 0, used to handle network logic, and maintain connection to server/mqtt Broker. 
// ( Most likly don't have to touch, unless adding bluetooth )
void mqttTask(void * parameter){
	connect_setup_mqtt(ssid, password, mqtt_server, 1883, fn_on_message_received);
	for(;;){
		check_maintain_mqtt_connection(client_id, client_user, client_pass, client_subscribe_topic); 
		vTaskDelay(500 / portTICK_PERIOD_MS);
	}
}

// Hardware Task: Assigned to core 1, used to handle hardware logic/ sensor data collection.
void hardwareTask(void * parameter){
	pinMode(ledPin_external, OUTPUT);
	pinMode(ledPin_internal, OUTPUT);
	pinMode(button_input, INPUT);

	for(;;){
		if(digitalRead(button_input) == HIGH){
			publish_message(client_publish_topic, "65w", 50);
			digitalWrite(ledPin_internal , HIGH);
			vTaskDelay(500 / portTICK_PERIOD_MS);
			digitalWrite(ledPin_internal, LOW);
		}
		if(message_recieved){
			digitalWrite(ledPin_external, HIGH);
			vTaskDelay(500 / portTICK_PERIOD_MS);
			digitalWrite(ledPin_external, LOW);
			message_recieved = false;
		}
		vTaskDelay(100 / portTICK_PERIOD_MS);  // Small delay to avoid busy looping
	}
}
