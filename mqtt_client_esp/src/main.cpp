#include "config.h"
#include "../main.h"
#include <WiFi.h>
#include <Arduino.h>
#include <PubSubClient.h>

/* Global Pin Config */
const int ledPin_external = 2;
const int button_input = 23;

/* Network Config */
const char* ssid = "YOUR_WIFI_USER";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server = "YOUR_LOCAL/PUBLIC_IP";

/* Client Config */
const char* client_id = "zot_plug_000001";
const char* client_user = "zot_plug_000001";
const char* client_pass =  "secret01";
const char* client_subscribe_topic = "plug/plug_000001/control/#";
const char* client_to_server_topic = "plug/plug_000001/data";

// When the server sends a message to this device. Via "client_subscribe_topic", decide what to do with it here. The topic is wildcarded "#". Meaning that anything past "/control", is a string you can check.
void fn_on_message_received(char* topic, byte* payload, unsigned int length ){
    if (val_incoming_topic(topic, client_subscribe_topic)) {
	Serial.println("Message received");
	Serial.print("Payload: ");
	for (unsigned int i = 0; i < length; i++) {
	  Serial.print((char)payload[i]);
	}
	Serial.println();
     	digitalWrite(ledPin_external, HIGH);
	delay(500);
	digitalWrite(ledPin_external, LOW);
	delay(500);
  }
}

void init_system(){
	Serial.begin(115200);
	connect_setup_mqtt(ssid, password, mqtt_server, 1883, fn_on_message_received); // !Needed!
	pinMode(ledPin_external, OUTPUT);
	pinMode(button_input, INPUT);
}

void loop_system(){
	check_maintain_mqtt_connection(client_id, client_user, client_pass, client_subscribe_topic); // !Needed!
	if(digitalRead(button_input) == HIGH){
		publish_message(client_to_server_topic, "65w", 50);
		digitalWrite(ledPin_external, HIGH);
		delay(500);
		digitalWrite(ledPin_external, LOW);
		delay(500);
	}
}

