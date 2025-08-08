#include "main.h"
#include "./src/env_config/env_config.h"

void setup(){
  Serial.begin(115200);

  if (!SPIFFS.begin(true)) {
      Serial.println("SPIFFS Mount Failed");
      return;
  }

  Env env = ensureEnvInNVS();
  if (!env.ok) {
    Serial.println("ENV not found in NVS and SPIFFS. Check config.env.");
    return;
  }

  // Create MQTT task on Core 0
  xTaskCreatePinnedToCore(mqttTask, "MQTT Task", 4096, NULL, 1, NULL, 0);

  // Create Button/Hardware task on Core 1
  xTaskCreatePinnedToCore(hardwareTask, "Hardware Task", 4096, NULL, 1, NULL, 1);
}

void loop(){
}
