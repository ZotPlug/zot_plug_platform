#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "../main.h"

const char* ssid = "SpectrumSetup-C9";
const char* password = "swiftbread735";
const char* mqtt_server = "192.168.1.146";  // Example: "192.168.1.5"
const int ledPin_external = 22;
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

void setup_mqtt() {
  setup_wifi();
  client.setServer(mqtt_server, 1883);
}

void loop_mqtt() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  client.publish("test/topic", "Hello from ESP32");
  delay(5000);
}

void init_system(){
	pinMode(ledPin_external, OUTPUT);
	pinMode(button_input, INPUT);
}

void blink_led(){
	if(digitalRead(button_input) == HIGH){
		digitalWrite(ledPin_external, HIGH);
		delay(3000);
		digitalWrite(ledPin_external, LOW);
		delay(3000);
	}
}
