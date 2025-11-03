#pragma once
#include <SPIFFS.h>
#include <Arduino.h> // For String

struct Env {
    String ssid, pass, mqtt, cid, cuser, cpass, sub, pub;
    bool ok = false;
};

/* Const keys to prevent typos */
extern const char* const K_SSID;
extern const char* const K_PASS;
extern const char* const K_MQTT_SERVER;
extern const char* const K_CLIENT_ID;
extern const char* const K_CLIENT_USER;
extern const char* const K_CLIENT_PASS;

Env ensureEnvInNVS();
Env loadCredsFromNVS();

