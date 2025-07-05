#include "main.h"

void setup(){
  Serial.begin(115200);
  // Create MQTT task on Core 0
  xTaskCreatePinnedToCore(mqttTask, "MQTT Task", 4096, NULL, 1, NULL, 0);

  // Create Button/Hardware task on Core 1
  xTaskCreatePinnedToCore(hardwareTask, "Button Task", 4096, NULL, 1, NULL, 1);
}

void loop(){
}
