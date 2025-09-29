#include "env_config.h"
#include <Preferences.h>
#include <FS.h>

/* Const vars to avoid typos */
const char* const K_SSID        = "WIFI_SSID";
const char* const K_PASS        = "WIFI_PASSWORD";
const char* const K_MQTT_SERVER = "MQTT_SERVER";
const char* const K_CLIENT_ID   = "CLIENT_ID";
const char* const K_CLIENT_USER = "CLIENT_USER";
const char* const K_CLIENT_PASS = "CLIENT_PASS";
const char* const K_CLIENT_SUB = "CLIENT_SUB_TOPIC";
const char* const K_CLIENT_PUB = "CLIENT_PUB_TOPIC";

const char* const NVS_NAMESPACE = "env";

Preferences prefs;

void saveCredsToNVS(const String& ssid, const String& pass, const String& mqtt, const String& cid, const String& cuser, const String& cpass, const String& sub, const String& pub) {
  prefs.begin(NVS_NAMESPACE, false); // namespace NVS_NAMESPACE, read-write
  prefs.putString(K_SSID, ssid);
  prefs.putString(K_PASS, pass);
  prefs.putString(K_MQTT_SERVER, mqtt);
  prefs.putString(K_CLIENT_ID, cid);
  prefs.putString(K_CLIENT_USER, cuser);
  prefs.putString(K_CLIENT_PASS, cpass);
  prefs.putString(K_CLIENT_SUB, sub);
  prefs.putString(K_CLIENT_PUB, pub);
  prefs.end(); // important: close handle
}

Env loadCredsFromNVS() {
  Env e;
  prefs.begin(NVS_NAMESPACE, true); // read-only
  // You can check presence first
  bool hasAll =
    prefs.isKey(K_SSID) &&
    prefs.isKey(K_PASS) &&
    prefs.isKey(K_MQTT_SERVER) &&
    prefs.isKey(K_CLIENT_ID) &&
    prefs.isKey(K_CLIENT_USER) &&
    prefs.isKey(K_CLIENT_PASS) &&
    prefs.isKey(K_CLIENT_SUB) &&
    prefs.isKey(K_CLIENT_PUB);

  if (hasAll) {
    e.ssid  = prefs.getString(K_SSID, "");
    e.pass  = prefs.getString(K_PASS, "");
    e.mqtt  = prefs.getString(K_MQTT_SERVER, "");
    e.cid   = prefs.getString(K_CLIENT_ID, "");
    e.cuser = prefs.getString(K_CLIENT_USER, "");
    e.cpass = prefs.getString(K_CLIENT_PASS, "");
    e.sub   = prefs.getString(K_CLIENT_SUB, "");
    e.pub   = prefs.getString(K_CLIENT_PUB, "");
    e.ok = true;
  }
  prefs.end();
  return e;
}

// If you need to delete one key
void eraseClientPass() {
  prefs.begin(NVS_NAMESPACE, false);
  prefs.remove(K_CLIENT_PASS);
  prefs.end();
}

// If you need to wipe the whole namespace
void wipeEnvNamespace() {
  prefs.begin(NVS_NAMESPACE, false);
  prefs.clear();
  prefs.end();
}

void debug_printEnv(const Env& e) {
    Serial.println(F("---- ENV DEBUG ----"));
    Serial.print(F("SSID: "));        Serial.println(e.ssid);
    Serial.print(F("PASS: "));        Serial.println(e.pass);
    Serial.print(F("MQTT: "));        Serial.println(e.mqtt);
    Serial.print(F("CLIENT_ID: "));   Serial.println(e.cid);
    Serial.print(F("CLIENT_USER: ")); Serial.println(e.cuser);
    Serial.print(F("CLIENT_PASS: ")); Serial.println(e.cpass);
    Serial.print(F("CLIENT_SUB_TOPIC: ")); Serial.println(e.sub);
    Serial.print(F("CLIENT_PUB_TOPIC: ")); Serial.println(e.pub);
    Serial.println(F("-------------------"));
}

Env loadFromSPIFFS(const char* path) {
  Env e;
  File f = SPIFFS.open(path, FILE_READ);
  if (!f) return e;

  Serial.println("File was found and opened");

  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.isEmpty() || line.startsWith("#")) continue;
    int eq = line.indexOf('=');
    if (eq < 0) continue;
    String k = line.substring(0, eq); k.trim();
    String v = line.substring(eq + 1); v.trim();

    if (k == K_SSID)        e.ssid  = v;
    else if (k == K_PASS) e.pass  = v;
    else if (k == K_MQTT_SERVER)   e.mqtt  = v;
    else if (k == K_CLIENT_ID)     e.cid   = v;
    else if (k == K_CLIENT_USER)   e.cuser = v;
    else if (k == K_CLIENT_PASS)   e.cpass = v;
    else if (k == K_CLIENT_SUB)     e.sub   = v;
    else if (k == K_CLIENT_PUB)     e.pub   = v;
  }
  f.close();

  e.ok = !(e.ssid.isEmpty() || e.pass.isEmpty() || e.mqtt.isEmpty()
           || e.cid.isEmpty() || e.cuser.isEmpty() || e.cpass.isEmpty() || e.sub.isEmpty() || e.pub.isEmpty());
  return e;
}

Env ensureEnvInNVS() {
  Env e = loadCredsFromNVS();

  if (e.ok) return e;

  // NVS missing. Try SPIFFS and migrate.
  Env f;
  f = loadFromSPIFFS("/config.env");

  if (f.ok) {
    saveCredsToNVS(f.ssid, f.pass, f.mqtt, f.cid, f.cuser, f.cpass, f.sub, f.pub);
    return f;
  }
  return Env{}; // still not ok
}


