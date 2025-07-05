#pragma once
#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>

extern PubSubClient client;
boolean val_incoming_topic(const char *topic, const char* client_subscribe_topic);
void publish_message(const char* topic, const char* payload, unsigned int message_size);
void connect_setup_mqtt(const char* ssid, const char* password, const char* mqtt_server, unsigned int port, void (*callback)(char*, byte*, unsigned int));
void check_maintain_mqtt_connection(const char* client_id, const char* client_user, const char*client_pass, const char* topic);





