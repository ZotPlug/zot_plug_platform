#pragma once

typedef enum {test, pin} SensorMode;
double get_and_reset_energy_total(SensorMode mode = pin);
void init_current_sensor(unsigned int currentSensorPin, float CURRENT_CAL);
void read_and_print_Irms();
double get_current_reading(SensorMode mode);
int get_voltage_reading(SensorMode mode);


