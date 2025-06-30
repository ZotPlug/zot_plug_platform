#include "../main.h"
#include <Arduino.h>

const int ledPin_external = 24;

void init_system(){
	pinMode(ledPin_external, OUTPUT);
}

void blink_led(){
	digitalWrite(ledPin_external, HIGH);
	delay(3000);
	digitalWrite(ledPin_external, LOW);
	delay(3000);
}

