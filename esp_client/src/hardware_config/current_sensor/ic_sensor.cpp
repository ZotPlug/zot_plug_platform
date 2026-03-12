#include "sensor.h"
#include <Arduino.h>

static volatile uint32_t cf_pulses  = 0;
static volatile uint32_t cf1_pulses = 0;
static volatile uint32_t cf_last_edge_us  = 0;
static volatile uint32_t cf1_last_edge_us = 0;

static uint32_t g_last_window_ms = 0;   // last time we computed window Hz
static constexpr uint32_t WINDOW_MS = 500; // 200–500ms is typical

// setting the CF pin to pin 25, on main.cpp we need to change the CF1 pin to GPIO26
// CF is the power pin
#ifndef HLW8012_CF_PIN
#define HLW8012_CF_PIN 25
#endif

// this is for power calibration
#ifndef POWER_CAL_W_PER_HZ
#define POWER_CAL_W_PER_HZ 0.0167f // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!!
#endif

// apparently old values keep repeating if there's no output frequency, so after this much time the output is set to 0
static constexpr uint32_t PULSE_TIMEOUT_US = 2000000UL; // 2 seconds in microseconds

// The CF1 pin is passed in from main.cpp via init_current_sensor(currentSensorPin,...)
static uint8_t g_cf1_pin = 0; // holds gpio number brought from main for CF1

// base calibration
static float g_current_cal_a_per_hz = 0.0166f; // !!!WILL NEED TO CHANGE THIS CALIBRATION VALUE AFTER TESTING!!!
static float g_power_cal_w_per_hz   = POWER_CAL_W_PER_HZ;

// always-applied base offset, before threshold scaling
static double g_base_current_offset_amps = 2.275; // tune this

// these values will be printed once per second with this
static unsigned long lastPrintMs = 0;

// these will be the variables that are output
static double amps  = 0.0;
static double watts = 0.0;

// raw values before dynamic correction
static double raw_amps  = 0.0;
static double raw_watts = 0.0;

// Energy accumulations
static double energy_kWh = 0.0;
static unsigned long lastSampleTimeMs = 0;

// Blend amount for threshold scaling
static double g_dynamic_strength = 1.0;

// Thresholds are now based on the offset-corrected current itself,
// not on any first reading / baseline.
struct CurrentCalBand {
    double max_offset_corrected_amps;
    double scale;
};

static CurrentCalBand g_current_bands[] = {
    {4.50, 0.53},
    {2.00, 0.63},
    {1.5, 0.81},
    {0.6, 0.688},
    {0.30, 1.12}
};

static double apply_current_calibration(double current_raw_amps) {
    // Step 1: always apply base offset first
    double offset_corrected = current_raw_amps - g_base_current_offset_amps;

    // Never allow negative readings
    if (offset_corrected <= 0.0) return 0.0;

    // Step 2: apply scale based on the current reading itself
    for (const auto &band : g_current_bands) {
        if (offset_corrected >= band.max_offset_corrected_amps) {
            double scaled = offset_corrected * band.scale;
            return offset_corrected + (scaled - offset_corrected) * g_dynamic_strength;
        }
    }

    return offset_corrected;
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

    noInterrupts();
    period_us    = period_us_v;
    last_edge_us = last_edge_us_v;
    interrupts();

    if (period_us == 0) return 0.0f;

    uint32_t now = (uint32_t)micros();
    uint32_t age = now - last_edge_us;
    if (age > PULSE_TIMEOUT_US) return 0.0f;

    return 1000000.0f / (float)period_us;
}

void init_current_sensor_ic(unsigned int currentSensorPin) {
    // main.cpp passes "currentSensorPin" — in HLW8012 mode this is CF1 pin
    g_cf1_pin = (uint8_t) currentSensorPin;

    pinMode(HLW8012_CF_PIN, INPUT);  // some boards might need INPUT_PULLUP
    pinMode(g_cf1_pin,      INPUT);

    // the HLW8012 sends the ESP32 square waves, so every rising edge counts as a pulse
    attachInterrupt(digitalPinToInterrupt(HLW8012_CF_PIN), isr_cf, RISING);
    attachInterrupt(digitalPinToInterrupt(g_cf1_pin),      isr_cf1, RISING);
}

// Only keep if we're not getting voltage from HLW8012
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

    // Old HLW8012 power calculation block
    // raw_watts = (double)(power_hz * g_power_cal_w_per_hz);
    raw_amps = (double)(current_hz * g_current_cal_a_per_hz);

    amps = apply_current_calibration(raw_amps);

    // New simplified power calculation:
    // Power = Current * 12V
    raw_watts = amps * 12.0;
    watts = raw_watts;

    return true;
}

void read_and_print_Irms_ic() {
    if (millis() - lastPrintMs < 1000) return;
    lastPrintMs = millis();

    refresh_measurements_from_window();

    double offset_corrected = raw_amps - g_base_current_offset_amps;
    if (offset_corrected < 0.0) offset_corrected = 0.0;

    Serial.print("Raw Current: ");
    Serial.print(raw_amps, 3);
    Serial.print(" A | Offset Current: ");
    Serial.print(offset_corrected, 3);
    Serial.print(" A | Corrected Current: ");
    Serial.print(amps, 3);
    Serial.print(" A | Active Power: ");
    Serial.print(watts, 1);
    Serial.println(" W");
}

double get_current_amps(bool relay_on) {
    if (!relay_on) {
        raw_amps = 0.0;
        raw_watts = 0.0;
        amps = 0.0;
        watts = 0.0;
        return 0.0;
    }

    refresh_measurements_from_window();
    return amps;
}

double get_active_power_watts(bool relay_on) {
    if (!relay_on) {
        raw_amps = 0.0;
        raw_watts = 0.0;
        amps = 0.0;
        watts = 0.0;
        return 0.0;
    }

    refresh_measurements_from_window();
    return watts;
}

static double get_power_reading_watts(SensorMode mode) {
    if (mode == SensorMode::pin) {
        refresh_measurements_from_window();
        return watts;
    }

    // Fake mode for testing
    watts = (double)random(0, 2000);
    amps  = watts / 120.0;
    return watts;
}

void calculate_energy_ic(SensorMode mode) {
    unsigned long nowMs = millis();

    if (lastSampleTimeMs == 0) {
        lastSampleTimeMs = nowMs;
        if (mode == SensorMode::pin) refresh_measurements_from_window();
        return;
    }

    double p_watts = get_power_reading_watts(mode);

    double elapsedHours = (nowMs - lastSampleTimeMs) / 3600000.0;

    energy_kWh += (p_watts * elapsedHours) / 1000.0;

    lastSampleTimeMs = nowMs;

    Serial.print("Irms est (A): ");
    Serial.print(amps, 3);
    Serial.print(" | Power (W): ");
    Serial.print(p_watts, 1);
    Serial.print(" | Energy (kWh): ");
    Serial.println(energy_kWh, 9);
}

double get_and_reset_energy_total_ic(SensorMode mode, bool relay_on) {
    if (relay_on) {
        calculate_energy_ic(mode);
        double temp = energy_kWh;
        energy_kWh = 0.0;
        return temp;
    } else {
        raw_amps = 0.0;
        raw_watts = 0.0;
        amps  = 0.0;
        watts = 0.0;
        energy_kWh = 0.0;
        return energy_kWh;
    }
}
