#include "main.h"

void setup(){
  Serial.begin(115200);
  //init_system();
  //setup_mqtt();
  Serial.println("ESP32 Serial Test");

}

void loop(){
  Serial.println("Still running...");
  delay(1000);

  //blink_led();
  //loop_mqtt();
}
