#pragma once
#include "sensor.h"
void init_current_sensor_ic(unsigned int currentSensorPin);
void read_and_print_Irms_ic();
double get_current_amps();
double get_active_power_watts();
void calculate_energy(SensorMode mode);
double get_and_reset_energy_total_ic(SensorMode mode);
