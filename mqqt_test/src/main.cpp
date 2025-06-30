#include "../main.h"
#include <Arduino.h>

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

