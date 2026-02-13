#include "sensor.h"
#include <Arduino.h> 
#include <EmonLib.h>
EnergyMonitor emon1;

#ifndef CURRENT_CAL 
#define CURRENT_CAL 50.0f
#endif

unsigned long lastCurrentPrint = 0;

const float V_LINE = 120.0;
const float POWER_FACTOR = 1.0;
double Irms;
double realPower;
double energy_kWh = 0;
unsigned long lastSampleTime = 0;

void init_current_sensor_old(unsigned int currentSensorPin){
	analogSetPinAttenuation(currentSensorPin, ADC_11db);
	analogReadResolution(12);
    	emon1.current(currentSensorPin, CURRENT_CAL);  // pin, calibration
}

void read_and_print_Irms_old(){
	if (millis() - lastCurrentPrint >= 1000) {
            Irms = emon1.calcIrms(1480);
            Serial.print("Current (Irms): ");
            Serial.print(Irms, 2);
            Serial.println(" A");
            lastCurrentPrint = millis();
        }
}

double get_current_reading(SensorMode mode){
        return (mode == SensorMode::pin) ? emon1.calcIrms(1480) : random(100, 900) / 1000.0;
}

int get_voltage_reading(SensorMode mode){
        // Mainly just for example
        return random(V_LINE - 5, V_LINE + 5);
}

void calculate_energy(SensorMode mode){
            Irms = get_current_reading(mode);
            // Estimate real power (Watts)
            realPower = Irms * V_LINE * POWER_FACTOR;

            // Time since last sample in hours
            unsigned long now = millis();
            double elapsedHours = (now - lastSampleTime) / 3600000.0;

            // Accumulate energy
            energy_kWh += (realPower * elapsedHours) / 1000.0; // convert W to kW-hours
            
            lastSampleTime = now;

            // Print results
            // Will want to comment this out, when not testing/ in prod.
            // Printing is a heavy operation.
            Serial.print("Irms (A): ");
            Serial.print(Irms, 3);
            Serial.print(" | Power (W): ");
            Serial.print(realPower, 1);
            Serial.print(" | Energy (kWh): ");
            Serial.println(energy_kWh, 9);
}

double get_and_reset_energy_total_old(SensorMode mode){
        calculate_energy(mode);
        double temp = energy_kWh;
        energy_kWh = 0;
        return temp;
}


