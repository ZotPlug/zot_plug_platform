#include <WiFi.h>
#include <PubSubClient.h>
#include <Arduino.h>
#include "../main.h"

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "YOUR_COMPUTER_LOCAL_IP";
const int ledPin_external = 22;
const int button_input = 23;

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

