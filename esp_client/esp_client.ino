#include "main.h"
#include "./src/env_config/env_config.h"
#include "./src/env_config/env_config.h"

void setup(){
  Serial.begin(115200);

  if (!SPIFFS.begin(true)) {   // true = format if mount fails
      Serial.println("SPIFFS Mount Failed");
      return;
  }

  Serial.println("SPIFFS mounted successfully");

  loadEnv("/config.env");
  /*

  // Create MQTT task on Core 0
  xTaskCreatePinnedToCore(mqttTask, "MQTT Task", 4096, NULL, 1, NULL, 0);

  // Create Button/Hardware task on Core 1
  xTaskCreatePinnedToCore(hardwareTask, "Button Task", 4096, NULL, 1, NULL, 1);
  */
}

void loop(){
}
