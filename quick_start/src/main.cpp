#include "../main.h"
#include <Arduino.h>

const int ledPin_external = 23;
const int ledPin_onBoard = 2;
void init_system(){
	pinMode(ledPin_external, OUTPUT);
	pinMode(ledPin_onBoard, OUTPUT);
}

void blink_led(){
	digitalWrite(ledPin_external, HIGH);
	digitalWrite(ledPin_onBoard , HIGH);
	delay(3000);
	digitalWrite(ledPin_external, LOW);
	digitalWrite(ledPin_onBoard , LOW);
	delay(3000);
}

