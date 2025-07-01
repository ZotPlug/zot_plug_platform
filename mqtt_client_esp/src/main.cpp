#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "../main.h"

const char* ssid = "YOUR_NETWORK_USER";
const char* password = "YOUR_WIFI_PASS";
const char* mqtt_server = "YOUR_LOCAL_IP";  // Example: "192.168.1.5"
const int ledPin_external = 2;
const int button_input = 23;

WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("ESP32Client")) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(2000);
    }
  }
}

void init_system(){
	Serial.begin(115200);
	setup_wifi();
	client.setServer(mqtt_server, 1883);
  	pinMode(ledPin_external, OUTPUT);
	pinMode(button_input, INPUT);
}

void loop_system(){
	if (!client.connected()) {
	  reconnect();
	}
	client.loop();
	if(digitalRead(button_input) == HIGH){
		client.publish("test/topic", "Hello from ESP32");
		digitalWrite(ledPin_external, HIGH);
		delay(500);
		digitalWrite(ledPin_external, LOW);
		delay(500);
	}
}
