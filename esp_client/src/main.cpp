#include "../main.h"
#include "./mqtt_config/mqtt_config.h"
#include "./env_config/env_config.h"
#include "./hardware_config/current_sensor/sensor.h"
#include "./hardware_config/current_sensor/ic_sensor.h"
#include "./hardware_config/relay/relay.h"
#include "HardwareSerial.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

/* Global Pin Config */
const unsigned int ledPin_external = 14;
const unsigned int ledPin_internal = 2;
const unsigned int button_input = 25; 
const unsigned int relayPin = 33;      // Pin connected to relay
const unsigned int currentSensorPin = 26;

/* Global Flags */
volatile boolean message_recieved = false;

/* General Global Vars */
const unsigned int one_minute = 60000;
unsigned long lastSendingTime = 0;
unsigned int timeInterval = 0;
constexpr unsigned int BUFFER_SIZE = 256;
StaticJsonDocument<BUFFER_SIZE> doc;
char buffer[BUFFER_SIZE];

/* Metering Global Vars */
double energyIncrement;
int volts;
double amps;
double power;

// When the server sends a message to this device. Via "client_subscribe_topic", decide what to do with it here.
void fn_on_message_received(char* topic, byte* payload, unsigned int length ){
    if (val_incoming_topic(topic, env.sub.c_str())) {
        const char* slash = strchr(topic, '/');
        if (strcmp(slash + 1, "cmd/relay/on") == 0){
            Serial.println("Relay On");
            turn_on_relay(relayPin);
        } else if (strcmp(slash + 1, "cmd/relay/off") == 0){
            turn_off_relay(relayPin);
            Serial.println("Relay off");
        }

        Serial.println("Message received");
        Serial.print("Payload: ");
        for (unsigned int i = 0; i < length; i++) {
          Serial.print((char)payload[i]);
        }
        Serial.println();
        message_recieved = true;
    }
}

void update_metering_vars_old(){ // Using old current sensor
    energyIncrement  = get_and_reset_energy_total_old(SensorMode::test);
    amps = get_current_reading(SensorMode::test);
    power = volts * amps;
    volts = get_voltage_reading(SensorMode::test);      
}

void update_metering_vars_ic() { 
    energyIncrement = get_and_reset_energy_total_ic(SensorMode::pin);
    //energyIncrement = get_and_reset_energy_total_ic(SensorMode::test);
    amps = get_current_amps();
    power = get_active_power_watts();
    volts = 120;
}

void send_device_reading() {
    if (millis() - lastSendingTime >= timeInterval) {
        //update_metering_vars_old();
        update_metering_vars_ic();
        
        // Allocate small JSON document (adjust only if you add many keys)
        doc["energyIncrement"] = energyIncrement;
        doc["voltage"] = volts;
        doc["current"] = amps;
        doc["deviceName"]  = env.cid;
        doc["power"] = power;

        size_t len = serializeJson(doc, buffer);

        publish_message(env.pub.c_str(), buffer, len);

        lastSendingTime = millis();
    }
}

// MQTT Task: Assigned to core 0, used to handle network logic, and maintain connection to server/mqtt Broker. 
// ( Most likly don't have to touch, unless adding bluetooth )
void mqttTask(void * parameter){
    // Load env vars into mem
    connect_setup_mqtt(env.ssid.c_str(), env.pass.c_str(), env.mqtt.c_str(), 1883, fn_on_message_received);
    for(;;){
        check_maintain_mqtt_connection(env.cid.c_str(), env.cuser.c_str(), env.cpass.c_str(), env.sub.c_str()); 
        vTaskDelay(500 / portTICK_PERIOD_MS);
    }
}

// Hardware Task: Assigned to core 1, used to handle hardware logic/ sensor data collection.
void hardwareTask(void * parameter){
    /* === Testing Pins/ Config === */
    pinMode(ledPin_external, OUTPUT);
    pinMode(ledPin_internal, OUTPUT);
    pinMode(button_input, INPUT);
    /* ============================ */

    /* === Relay + Serial setup === */
    init_relay(relayPin);
    /* ============================ */

    /* === current sensor setup === */
    //init_current_sensor_old(currentSensorPin);
    init_current_sensor_ic(currentSensorPin);
    /* ============================================ */

    timeInterval = one_minute * .25; // Set interval, in which you send power data to backend

    for(;;){
        /* === Testing Logic === */
        if(digitalRead(button_input) == HIGH){
            publish_message(env.pub.c_str(), "65w", 50);
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
        /* ============================ */

        /* === Relay Serial Command Handler === */
        relay_serial_command_handler(relayPin);
       /* ===================================== */

        /* === NEW: Read Irms via EmonLib (prints every ~1s) ===
           calcIrms(N) samples ~a few mains cycles (1480 is common).
           Tweak N if you want quicker/steadier reads.
        */
        //read_and_print_Irms();
        send_device_reading();

        vTaskDelay(100 / portTICK_PERIOD_MS);  // Small delay to avoid busy looping
    }
}
