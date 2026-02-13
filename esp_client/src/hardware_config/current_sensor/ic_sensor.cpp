#include "sensor.h"
#include <Arduino.h>

// setting the CF pin to pin 25, on main.cpp we need to change the CF1's pin to GPIO26
// CF is the power pin
#ifndef HLW8012_CF_PIN
#define HLW8012_CF_PIN 25
#endif

// this is for power calibration
#ifndef POWER_CAL_W_PER_HZ
#define POWER_CAL_W_PER_HZ 1.2f // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!!
#endif

#ifndef CURRENT_CAL 
#define CURRENT_CAL 50.0f
#endif

//apparently old values keep repeating if there's no output frequency, so we make it so after this much time the output is set to 0
static constexpr uint32_t PULSE_TIMEOUT_US = 2000000UL; // 2 seconds in microseconds

// The CF1 pin is passed in from main.cpp via init_current_sensor(currentSensorPin,...) *Chat note
static uint8_t g_cf1_pin = 0; //holds gpio number brought from main for CF1

// setting calibration
static float g_current_cal_a_per_hz = 0.003f; // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!! (Also I think we have to set the CURRENT_CAL = 0.003 on main.cpp
static float g_power_cal_w_per_hz   = POWER_CAL_W_PER_HZ;

// for pulse timings which will be used to find the period for power
static volatile uint32_t cf_last_us       = 0;  // last pulse time (microseconds) *Chat note
static volatile uint32_t cf_period_us     = 0;  // time between last two pulses *Chat note
static volatile uint32_t cf_last_edge_us  = 0;  // time of most recent pulse edge *Chat note

// for pulse timings which will be used to find the period for current
static volatile uint32_t cf1_last_us      = 0;
static volatile uint32_t cf1_period_us    = 0;
static volatile uint32_t cf1_last_edge_us = 0;

// these values will be printed once per second with this
static unsigned long lastPrintMs = 0;

// these will be the variables that are outputed
static double amps  = 0.0;
static double watts = 0.0;

// Energy accumulations
static double energy_kWh = 0.0;
static unsigned long lastSampleTimeMs = 0;


// amount of time that has run since ESP32 is on in microseconds
static void IRAM_ATTR isr_cf() {
    uint32_t now = (uint32_t) micros();

    // If we've seen at least one pulse before, we can compute a period. *Chat note
    if (cf_last_us != 0) {
        cf_period_us = now - cf_last_us;   // Time between this pulse and last pulse *Chat note
    }

    // Save timestamps for next time *Chat note
    cf_last_us = now;
    cf_last_edge_us = now;
}

//pulses for current
static void IRAM_ATTR isr_cf1() {
    uint32_t now = (uint32_t) micros();

    if (cf1_last_us != 0) {
        cf1_period_us = now - cf1_last_us;
    }

    cf1_last_us = now;
    cf1_last_edge_us = now;
}

/*
  !!! Chat's explanation for the period (essentially finding the period through time between pulses)
  HLW8012 gives pulses. We want frequency in Hz:
    Hz = pulses per second

  If we know the time between pulses (period):
    period_seconds = period_us / 1,000,000
    Hz = 1 / period_seconds
       = 1,000,000 / period_us

  NOTE: Interrupts may change period_us while we read it.
  So we copy the values while interrupts are briefly disabled.
*/
static float read_frequency_hz(volatile uint32_t &period_us_v,
                               volatile uint32_t &last_edge_us_v) {
    uint32_t period_us;
    uint32_t last_edge_us;

    // Temporarily block interrupts so the ISR doesn't update mid-read *Chat note
    noInterrupts();
    period_us    = period_us_v;
    last_edge_us = last_edge_us_v;
    interrupts();
    
    //when there's no measurement made yet
    if (period_us == 0) return 0.0f;

    // we use PULSE_TIMEOUT_US from earlier to set to 0 if there are no pulses
    uint32_t now = (uint32_t) micros();
    uint32_t age = now - last_edge_us;
    if (age > PULSE_TIMEOUT_US) return 0.0f;

    // period to frequency
    return 1000000.0f / (float)period_us;
}

void init_current_sensor_ic(unsigned int currentSensorPin) {
    // main.cpp passes "currentSensorPin" — in HLW8012 mode this is CF1 pin *Chat note
    g_cf1_pin = (uint8_t) currentSensorPin;

    g_current_cal_a_per_hz = CURRENT_CAL;

    // setting these pins as inputs
    pinMode(HLW8012_CF_PIN, INPUT);  // some boards might need INPUT_PULLUP
    pinMode(g_cf1_pin,      INPUT);

    // !!!the HLW8012 basically sends the ESP32 a square waves, so when ever there's it goes up it counts as a "pulse"
    attachInterrupt(digitalPinToInterrupt(HLW8012_CF_PIN), isr_cf, RISING);
    attachInterrupt(digitalPinToInterrupt(g_cf1_pin),      isr_cf1, RISING);
}

void read_and_print_Irms_ic() {
    // Only print once per second *Chat note
    if (millis() - lastPrintMs < 1000) return;
    lastPrintMs = millis();

    // converting period to frequency
    float power_hz   = read_frequency_hz(cf_period_us,  cf_last_edge_us);
    float current_hz = read_frequency_hz(cf1_period_us, cf1_last_edge_us);

    // converting frequency to power and current
    watts = (double)(power_hz   * g_power_cal_w_per_hz);
    amps  = (double)(current_hz * g_current_cal_a_per_hz);

    // print result
    Serial.print("Current (RMS est): ");
    Serial.print(amps, 3);
    Serial.print(" A | Active Power est: ");
    Serial.print(watts, 1);
    Serial.println(" W");
}

double get_current_amps() {
    return amps;
}

double get_active_power_watts() {
    return watts;
}

// Only keep if were not getting voltage from HLW8012
static void refresh_measurements_from_hz() {
    float power_hz   = read_frequency_hz(cf_period_us,  cf_last_edge_us);
    float current_hz = read_frequency_hz(cf1_period_us, cf1_last_edge_us);

    watts = (double)(power_hz   * g_power_cal_w_per_hz);
    amps  = (double)(current_hz * g_current_cal_a_per_hz);
}

static double get_power_reading_watts(SensorMode mode) {
    if (mode == SensorMode::pin) {
        refresh_measurements_from_hz();
        return watts;
    }
    // Fake mode for testing, similar spirit to your old random current
    watts = (double)random(0, 2000);        
    amps  = watts / 120.0;                    
    return watts; 
}

void calculate_energy_ic(SensorMode mode) {
    unsigned long nowMs = millis();

    if (lastSampleTimeMs == 0) {
        lastSampleTimeMs = nowMs;
        // Still refresh once so watts/amps are not stale
        if (mode == SensorMode::pin) refresh_measurements_from_hz();
        return;
    }

    double p_watts = get_power_reading_watts(mode);

    // Time since last sample in hours
    double elapsedHours = (nowMs - lastSampleTimeMs) / 3600000.0;

    // Accumulate energy in kWh
    energy_kWh += (p_watts * elapsedHours) / 1000.0;

    lastSampleTimeMs = nowMs;

    // Debug prints (same idea as old code, comment out for prod)
    Serial.print("Irms est (A): ");
    Serial.print(amps, 3);
    Serial.print(" | Power (W): ");
    Serial.print(p_watts, 1);
    Serial.print(" | Energy (kWh): ");
    Serial.println(energy_kWh, 9);
}

double get_and_reset_energy_total_ic(SensorMode mode) {
    calculate_energy_ic(mode);
    double temp = energy_kWh;
    energy_kWh = 0.0;
    return temp;
}



