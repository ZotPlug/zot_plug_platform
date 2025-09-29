#include "mqtt_config.h"
#include "HardwareSerial.h"
#include <WiFi.h>

WiFiClient espClient;

void setup_wifi(const char *ssid, const char *password){
  vTaskDelay(10 / portTICK_PERIOD_MS);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    vTaskDelay(500 / portTICK_PERIOD_MS);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
}

PubSubClient client(espClient);

void reconnect(const char *client_id, const char *client_user, const char *client_pass, const char* topic){
   while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(client_id , client_user, client_pass)) {
      client.subscribe(topic);
      Serial.println("connected");
      vTaskDelay(500 / portTICK_PERIOD_MS);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      vTaskDelay(500 / portTICK_PERIOD_MS);
    }
  }
}

void publish_message(const char* topic, const char* payload, unsigned int message_size ){
  char buffer[message_size];
  snprintf(buffer, sizeof(buffer), "%s", payload);
  client.publish(topic, buffer);
}

void connect_setup_mqtt(const char *ssid, const char *password, const char *mqtt_server, unsigned int port, void (*callback)(char*, byte*, unsigned int)){
  	setup_wifi(ssid, password);
	client.setServer(mqtt_server, port);
	client.setCallback(callback);
}

void check_maintain_mqtt_connection(const char* client_id, const char* client_user, const char*client_pass, const char* topic){
  	if (!client.connected()) {
	  reconnect(client_id, client_user, client_pass, topic);
	}
	client.loop();
}
//-1 to account for the wildcard "#" char
boolean val_incoming_topic(const char* topic, const char* client_subscribe_topic){
  return strncmp(topic, client_subscribe_topic, strlen(client_subscribe_topic) - 1) == 0 ? true : false;
}

