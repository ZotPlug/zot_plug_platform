#include "../main.h"
#include "./mqtt_config/mqtt_config.h"
#include "env_config/env_config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <EmonLib.h>

EnergyMonitor emon1;

const char* client_subscribe_topic = "plug/plug_000001/control/#";
const char* client_publish_topic = "plug/plug_000001/data";

/* Global Pin Config */
const int ledPin_external = 22;
const int ledPin_internal = 2;
const int button_input = 23;
const int relayPin = 26;      // Pin connected to relay
bool relayState = false;      // Track relay state
const int currentSensorPin = 34;
const float CURRENT_CAL = 50.0f; // calibration for 50A:1V CT

/* Global Flags */
volatile boolean message_recieved = false;

// When the server sends a message to this device. Via "client_subscribe_topic", decide what to do with it here.
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
    Env env = loadCredsFromNVS();
    connect_setup_mqtt(env.ssid.c_str(), env.pass.c_str(), env.mqtt.c_str(), 1883, fn_on_message_received);
    for(;;){
        check_maintain_mqtt_connection(env.cid.c_str(), env.cuser.c_str(), env.cpass.c_str(), client_subscribe_topic); 
        vTaskDelay(500 / portTICK_PERIOD_MS);
    }
}

// Hardware Task: Assigned to core 1, used to handle hardware logic/ sensor data collection.
void hardwareTask(void * parameter){
    pinMode(ledPin_external, OUTPUT);
    pinMode(ledPin_internal, OUTPUT);
    pinMode(button_input, INPUT);

    /* === Relay + Serial Setup === */
    Serial.begin(115200);
    pinMode(relayPin, OUTPUT);
    digitalWrite(relayPin, LOW);
    /* ============================ */

    /* current sensor */
    analogSetPinAttenuation(currentSensorPin, ADC_11db);
    analogReadResolution(12);
    emon1.current(currentSensorPin, CURRENT_CAL);  // pin, calibration
    /* ============================================ */

    unsigned long lastCurrentPrint = 0;

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

        /* === Relay Serial Command Handler === */
        if (Serial.available() > 0) {
            String command = Serial.readStringUntil('\n');
            command.trim();
            command.toUpperCase();

            if (command == "ON" || command == "1") {
                digitalWrite(relayPin, HIGH);
                relayState = true;
                Serial.println("Relay turned ON");
            } 
            else if (command == "OFF" || command == "0") {
                digitalWrite(relayPin, LOW);
                relayState = false;
                Serial.println("Relay turned OFF");
            } 
            else if (command == "STATUS") {
                Serial.print("Relay status: ");
                Serial.println(relayState ? "ON" : "OFF");
            } 
            else if (command.length() > 0) {
                Serial.println("Invalid command. Use: ON, OFF, 1, 0, or STATUS");
            }
        }
        /* ===================================== */

        /* === NEW: Read Irms via EmonLib (prints every ~1s) ===
           calcIrms(N) samples ~a few mains cycles (1480 is common).
           Tweak N if you want quicker/steadier reads.
        */
        if (millis() - lastCurrentPrint >= 1000) {
            double amps = emon1.calcIrms(1480);
            Serial.print("Current (Irms): ");
            Serial.print(amps, 2);
            Serial.println(" A");
            lastCurrentPrint = millis();
        }

        vTaskDelay(100 / portTICK_PERIOD_MS);  // Small delay to avoid busy looping
    }
}
