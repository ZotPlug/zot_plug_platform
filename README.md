
# ZotPlug Firmware

Firmware for the ZotPlug embedded system, powered by the ESP32 microcontroller.

## Dependencies

- Arduino CLI for building and flashing
- ESP32 Board Package via Arduino CLI
- PubSubClient and EmonLib Arduino libraries
- MQTT broker (e.g., Aedes) running on your local network
- Serial monitor tool (arduino-cli monitor, minicom, etc.)


## Flashing & Monitoring

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 .
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 .
arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200
```

## 📡 Network Notes

- Ensure your computer and the ESP32 are on the same WiFi network.
- Default MQTT port: 1883

## 📝 Setup Documentation

For complete setup instructions, see the [Setup Guide on Google Docs](https://docs.google.com/document/d/1jFlQuHnFwy8aJPPMJ6DQvYgvtMj_6Ua5th_mMhYTuXo/edit?usp=sharing).




