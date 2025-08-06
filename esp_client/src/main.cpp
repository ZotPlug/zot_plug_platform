#include "../main.h"
#include "config.h"
#include <WiFi.h>
#include <Arduino.h>
#include <PubSubClient.h>
#include <EmonLib.h>   // Current sensor
#include <Wire.h>

// test
// test 2

// ===== Network Config =====
const char* ssid = "2.4_Wifi";
const char* password = "lunachang";
const char* mqtt_server = "192.168.0.101";

// ===== Client Config =====
const char* client_id = "zot_plug_000001";
const char* client_user = "zot_plug_000001";
const char* client_pass = "secret01";
const char* client_subscribe_topic = "plug/plug_000001/control/#"; // Wildcard to listen for all control messages
const char* client_publish_topic = "plug/plug_000001/data";

// ===== Pin Config =====
const int ledPin_internal = 2;
const int button_input = 23;
const int currentSensorPin = 34;
const int relayPin = 26; // Relay control pin

// ===== Global Flags & Vars =====
volatile boolean message_recieved = false;
String relayCommand = "";

// ===== Global Objects =====
EnergyMonitor emon;
const float voltage = 120.0;

// ===== MQTT Callback =====
void fn_on_message_received(char* topic, byte* payload, unsigned int length) {
    String incoming = "";
    for (unsigned int i = 0; i < length; i++) {
        incoming += (char)payload[i];
    }
    incoming.trim();

    Serial.print("Message received on topic: ");
    Serial.println(topic);
    Serial.print("Payload: ");
    Serial.println(incoming);

    // Check if it's the relay control topic
    String topicStr = String(topic);
    if (topicStr == "plug/plug_000001/control/relay") {
        relayCommand = incoming;
        if (relayCommand == "on") {
            digitalWrite(relayPin, HIGH);
            Serial.println("Relay turned ON");
        } else if (relayCommand == "off") {
            digitalWrite(relayPin, LOW);
            Serial.println("Relay turned OFF");
        }
    }

    message_recieved = true;
}

// ===== MQTT Task =====
void mqttTask(void * parameter) {
    connect_setup_mqtt(ssid, password, mqtt_server, 1883, fn_on_message_received);
    for(;;) {
        check_maintain_mqtt_connection(client_id, client_user, client_pass, client_subscribe_topic);
        vTaskDelay(500 / portTICK_PERIOD_MS);
    }
}

// ===== Hardware Task =====
void hardwareTask(void * parameter) {
    pinMode(ledPin_internal, OUTPUT);
    pinMode(button_input, INPUT);
    pinMode(relayPin, OUTPUT);
    digitalWrite(relayPin, LOW); // Start with relay OFF

    emon.current(currentSensorPin, 50.0);

    for(;;) {
        double current = emon.calcIrms(1480);
        double power = current * voltage;

        Serial.print("Current: ");
        Serial.print(current, 2);
        Serial.print(" A, Power: ");
        Serial.print(power, 1);
        Serial.println(" W");

        if (digitalRead(button_input) == HIGH) {
            publish_message(client_publish_topic, "65w", 50);
            digitalWrite(ledPin_internal, HIGH);
            vTaskDelay(500 / portTICK_PERIOD_MS);
            digitalWrite(ledPin_internal, LOW);
        }

        if (message_recieved) {
            digitalWrite(ledPin_internal, HIGH);
            vTaskDelay(200 / portTICK_PERIOD_MS);
            digitalWrite(ledPin_internal, LOW);
            message_recieved = false;
        }

        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}