#include "env_config.h"
#include <FS.h>
#include <Arduino.h>

std::map<std::string, std::string> envVars;

static inline std::string to_std(const String& s) { return std::string(s.c_str()); }

void loadEnv(const char* path) {
  File file = SPIFFS.open(path, FILE_READ);
  if (!file) { Serial.println("Failed to open .env file"); return; }

  while (file.available()) {
    String line = file.readStringUntil('\n');
    line.trim();
    if (line.length() == 0 || line.startsWith("#")) continue;

    int separatorIndex = line.indexOf('=');
    if (separatorIndex == -1) continue;

    String key = line.substring(0, separatorIndex);
    String value = line.substring(separatorIndex + 1);
    key.trim(); value.trim();

    envVars[to_std(key)] = to_std(value);
  }

  file.close();
}


