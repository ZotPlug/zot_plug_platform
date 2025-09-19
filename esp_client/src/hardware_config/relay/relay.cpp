#include "relay.h"

volatile boolean relayState = false;

void init_relay(unsigned int relayPin){
    pinMode(relayPin, OUTPUT);
    digitalWrite(relayPin, LOW);
}

void turn_on_relay(unsigned int relayPin){
    digitalWrite(relayPin, HIGH);
    relayState = true;
}

void turn_off_relay(unsigned int relayPin){
    digitalWrite(relayPin, LOW);
    relayState = false;
}

void relay_serial_command_handler(unsigned int relayPin){
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');
        command.trim();
        command.toUpperCase();

        if (command == "ON" || command == "1") {
            turn_on_relay(relayPin);
            Serial.println("Relay turned ON");
        } 
        else if (command == "OFF" || command == "0") {
            turn_off_relay(relayPin);
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
}
