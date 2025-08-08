#pragma once
#include <SPIFFS.h>
#include <map>
#include <string>

extern std::map<std::string, std::string> envVars;
void loadEnv(const char* path);
