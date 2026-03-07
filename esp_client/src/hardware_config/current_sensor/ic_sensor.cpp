#include "sensor.h"
#include <Arduino.h>

static volatile uint32_t cf_pulses  = 0;
static volatile uint32_t cf1_pulses = 0;
static volatile uint32_t cf_last_edge_us  = 0;
static volatile uint32_t cf1_last_edge_us = 0;

static uint32_t g_last_window_ms = 0;   // last time we computed window Hz
static constexpr uint32_t WINDOW_MS = 500; // 200–500ms is typical

// setting the CF pin to pin 25, on main.cpp we need to change the CF1's pin to GPIO26
// CF is the power pin
#ifndef HLW8012_CF_PIN
#define HLW8012_CF_PIN 25
#endif

// this is for power calibration
#ifndef POWER_CAL_W_PER_HZ
#define POWER_CAL_W_PER_HZ 0.0167f // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!!
#endif

//apparently old values keep repeating if there's no output frequency, so we make it so after this much time the output is set to 0
static constexpr uint32_t PULSE_TIMEOUT_US = 2000000UL; // 2 seconds in microseconds

// The CF1 pin is passed in from main.cpp via init_current_sensor(currentSensorPin,...) *Chat note
static uint8_t g_cf1_pin = 0; //holds gpio number brought from main for CF1

// setting calibration
static float g_current_cal_a_per_hz = 0.0166f; // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!! (Also I think we have to set the CURRENT_CAL = 0.003 on main.cpp
static float g_power_cal_w_per_hz   = POWER_CAL_W_PER_HZ;

// these values will be printed once per second with this
static unsigned long lastPrintMs = 0;

// these will be the variables that are outputed
static double amps  = 0.0;
static double watts = 0.0;

// Energy accumulations
static double energy_kWh = 0.0;
static unsigned long lastSampleTimeMs = 0;

struct RelativeCurrentCalBand {
    double max_ratio_to_first;
    double scale;
    double offset;
};

static RelativeCurrentCalBand g_relative_bands[] = {
    {1.25, 1.00, 0.00},
    {2.00, 0.96, 0.00},
    {3.00, 0.91, 0.00},
    {4.00, 0.87, 0.00},
    {999.0, 0.83, 0.00}
};

static double raw_amps  = 0.0;
static double raw_watts = 0.0;

static bool g_prev_relay_on = false;
static unsigned long g_relay_on_ms = 0;

static bool g_baseline_captured = false;
static double g_first_avg_amps = 0.0;
static double g_baseline_sum = 0.0;
static int g_baseline_count = 0;

static constexpr double BASELINE_MIN_AMPS = 0.08;
static constexpr uint32_t BASELINE_SETTLE_MS = 1000;
static constexpr int BASELINE_SAMPLES_NEEDED = 3;

static double g_dynamic_strength = 1.0;

static void update_relay_calibration_state(bool relay_on) {
    if (relay_on && !g_prev_relay_on) {
        g_relay_on_ms = millis();
        g_baseline_captured = false;
        g_first_avg_amps = 0.0;
        g_baseline_sum = 0.0;
        g_baseline_count = 0;
    }

    if (!relay_on) {
        g_baseline_captured = false;
        g_first_avg_amps = 0.0;
        g_baseline_sum = 0.0;
        g_baseline_count = 0;
    }

    g_prev_relay_on = relay_on;
}

static void try_capture_first_baseline(bool relay_on, double current_raw_amps) {
    if (!relay_on) return;
    if (g_baseline_captured) return;
    if (millis() - g_relay_on_ms < BASELINE_SETTLE_MS) return;
    if (current_raw_amps < BASELINE_MIN_AMPS) return;

    g_baseline_sum += current_raw_amps;
    g_baseline_count++;

    if (g_baseline_count >= BASELINE_SAMPLES_NEEDED) {
        g_first_avg_amps = g_baseline_sum / (double)g_baseline_count;
        g_baseline_captured = true;
    }
}

static double apply_dynamic_current_calibration(double current_raw_amps) {
    if (current_raw_amps <= 0.0) return 0.0;
    if (!g_baseline_captured || g_first_avg_amps <= 0.0) return current_raw_amps;

    double ratio = current_raw_amps / g_first_avg_amps;

    for (const auto &band : g_relative_bands) {
        if (ratio <= band.max_ratio_to_first) {
            double corrected = (current_raw_amps * band.scale) + band.offset;
            return current_raw_amps + (corrected - current_raw_amps) * g_dynamic_strength;
        }
    }

    return current_raw_amps;
}

static void IRAM_ATTR isr_cf() {
    cf_pulses++;
    cf_last_edge_us = (uint32_t)micros();
}

static void IRAM_ATTR isr_cf1() {
    cf1_pulses++;
    cf1_last_edge_us = (uint32_t)micros();
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

    // setting these pins as inputs
    pinMode(HLW8012_CF_PIN, INPUT);  // some boards might need INPUT_PULLUP
    pinMode(g_cf1_pin,      INPUT);

    // !!!the HLW8012 basically sends the ESP32 a square waves, so when ever there's it goes up it counts as a "pulse"
    attachInterrupt(digitalPinToInterrupt(HLW8012_CF_PIN), isr_cf, RISING);
    attachInterrupt(digitalPinToInterrupt(g_cf1_pin),      isr_cf1, RISING);
}

// Only keep if were not getting voltage from HLW8012
static bool refresh_measurements_from_window() {
    uint32_t now_ms = millis();
    if (g_last_window_ms == 0) {
        g_last_window_ms = now_ms;
        return false;
    }

    uint32_t elapsed_ms = now_ms - g_last_window_ms;
    if (elapsed_ms < WINDOW_MS) return false;

    uint32_t p_cf, p_cf1;
    uint32_t last_edge_cf_us, last_edge_cf1_us;

    noInterrupts();
    p_cf = cf_pulses;   cf_pulses = 0;
    p_cf1 = cf1_pulses; cf1_pulses = 0;
    last_edge_cf_us = cf_last_edge_us;
    last_edge_cf1_us = cf1_last_edge_us;
    interrupts();

    g_last_window_ms = now_ms;

    float seconds = elapsed_ms / 1000.0f;

    uint32_t now_us = (uint32_t)micros();
    if ((now_us - last_edge_cf_us)  > PULSE_TIMEOUT_US) p_cf = 0;
    if ((now_us - last_edge_cf1_us) > PULSE_TIMEOUT_US) p_cf1 = 0;

    float power_hz   = (seconds > 0.0f) ? (p_cf  / seconds) : 0.0f;
    float current_hz = (seconds > 0.0f) ? (p_cf1 / seconds) : 0.0f;

    raw_watts = (double)(power_hz   * g_power_cal_w_per_hz);
    raw_amps  = (double)(current_hz * g_current_cal_a_per_hz);

    amps  = apply_dynamic_current_calibration(raw_amps);
    watts = raw_watts;

    return true;
}
/*
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
*/

void read_and_print_Irms_ic() {
    if (millis() - lastPrintMs < 1000) return;
    lastPrintMs = millis();

    refresh_measurements_from_window();

    Serial.print("Raw Current: ");
    Serial.print(raw_amps, 3);
    Serial.print(" A | Corrected Current: ");
    Serial.print(amps, 3);
    Serial.print(" A | Active Power: ");
    Serial.print(watts, 1);
    Serial.print(" W | Baseline: ");
    Serial.println(g_first_avg_amps, 3);
}

double get_current_amps(bool relay_on) {
    update_relay_calibration_state(relay_on);

    if (!relay_on) {
        raw_amps = 0.0;
        raw_watts = 0.0;
        amps = 0.0;
        watts = 0.0;
        return 0.0;
    }

    bool updated = refresh_measurements_from_window();
    if (updated) {
        try_capture_first_baseline(relay_on, raw_amps);
    }

    return amps;
}

double get_active_power_watts(bool relay_on) {
    update_relay_calibration_state(relay_on);

   if (!relay_on) {
        raw_amps = 0.0;
        raw_watts = 0.0;
        amps = 0.0;
        watts = 0.0;
        return 0.0;
    }

    bool updated = refresh_measurements_from_window();
    if(updated){
        try_capture_first_baseline(relay_on, raw_amps);
    }

    return watts;
}

static double get_power_reading_watts(SensorMode mode) {
    if (mode == SensorMode::pin) {
        refresh_measurements_from_window();
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
        if (mode == SensorMode::pin) refresh_measurements_from_window();
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

double get_and_reset_energy_total_ic(SensorMode mode, bool relay_on) {
    if(relay_on){
        calculate_energy_ic(mode);
        double temp = energy_kWh;
        energy_kWh = 0.0;
        return temp;
    } else {
        amps  = 0.0;
        watts = 0.0;
        energy_kWh = 0.0;
        return energy_kWh;
    }
}



