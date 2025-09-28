#pragma once
#include "./src/env_config/env_config.h"

extern Env env;
void mqttTask(void * parameter);
void hardwareTask(void * parameter);
