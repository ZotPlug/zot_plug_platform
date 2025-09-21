#include "sensor.h"
#include <Arduino.h> 
#include <EmonLib.h>

EnergyMonitor emon1;
unsigned long lastCurrentPrint = 0;
double amps;

void init_current_sensor(unsigned int currentSensorPin, float CURRENT_CAL){
	analogSetPinAttenuation(currentSensorPin, ADC_11db);
	analogReadResolution(12);
    	emon1.current(currentSensorPin, CURRENT_CAL);  // pin, calibration
}

void read_and_print_Irms(){
	if (millis() - lastCurrentPrint >= 1000) {
            amps = emon1.calcIrms(1480);
            Serial.print("Current (Irms): ");
            Serial.print(amps, 2);
            Serial.println(" A");
            lastCurrentPrint = millis();
        }
}
