#pragma once

typedef enum {test, pin} PowerCalcMode;
double get_and_reset_power_total(PowerCalcMode mode = pin);
void init_current_sensor(unsigned int currentSensorPin, float CURRENT_CAL);
void read_and_print_Irms();
