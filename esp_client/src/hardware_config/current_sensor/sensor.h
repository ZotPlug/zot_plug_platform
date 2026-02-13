#pragma once

typedef enum {test, pin} SensorMode;
double get_and_reset_energy_total_old(SensorMode mode = pin);
void init_current_sensor_old(unsigned int currentSensorPin);
void read_and_print_Irms_old();
double get_current_reading(SensorMode mode);
int get_voltage_reading(SensorMode mode);


