#pragma once
#include <Arduino.h> // For String

extern volatile boolean relayState;
void init_relay(unsigned int relayPin);
void turn_on_relay(unsigned int relayPin);
void turn_off_relay(unsigned int relayPin);
void relay_serial_command_handler(unsigned int relayPin);

