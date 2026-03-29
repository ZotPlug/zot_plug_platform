# Software Development Workflow

## Pre-requisites
1. Install [Docker](https://docs.docker.com/engine/install/#supported-platforms) via the official instructions for your platform.

## Dev Steps  
1. Navigate to the backend infrastructure directory
   ```bash
   cd ./zot_plug_platform/infra
   ```
2. Create a .env file, with the following:
   ```bash
   PG_HOST=postgres-dev
   PG_PORT=5432
   PG_USER=myuser
   PG_PASSWORD=mypassword
   PG_DATABASE=mydb
   MQTT_URL=mqtt://broker:1883
   SIGNING_KEY=super_duper_secret
   ```
3. Start the development stack.
   Run with the `dev` profile to launch only development-specific containers:

   ```bash
   docker compose --profile dev up
   ```
   > This will start services like `api-dev`, `postgres`, and any other containers tagged with `profiles: ["dev"]`.

# Hardware Development Workflow

## **Pre-requisites**  
1. Install [Node.js and npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm). 

2. Navigate to the broker directory from the project root.
   ```bash
   cd ./infra/broker_mqtt
   ```
3. Install the project dependencies.
   ```bash
   npm install
   ```
4. Install PlatformIO Core (CLI).

   **MacOS**:
   ```bash
   brew install platformio
   ```
   **Windows & Linux**:  
   - Via [Installer Script (Recommended)](https://docs.platformio.org/en/latest/core/installation/methods/installer-script.html)  
   - Or [Python Package Manage](https://docs.platformio.org/en/latest/core/installation/methods/pypi.html)

5. Install the [Arduino CLI](https://arduino.github.io/arduino-cli/0.32/installation/).

## *Dev Steps*  

1. Update Network Config
   - Open `./esp_client/data`
   - Copy `config.env.example` to `config.env`
   - Update your network and device credentials in `config.env`

2. Upload `config.env` into the ESP32.
   - Navigate to `./esp_client/`
   - Plug in your ESP32
   - Run:
     ```bash
     pio run --target uploadfs
     ```
   > **Note:** To remove `config.env`:
   > ```bash
   > pio run -t erase
   > # You will need to re-upload your code as well (this wipes the entire flash)
   > ```

3. Run the MQTT Broker. 
    From the project root, run:
   ```bash
   npx tsx ./infra/broker_mqtt/server.ts
   ```
4. The firmware files can be found at `./esp_client/src`.

5. Reflash the ESP32 and test against your local broker.

## Flashing & Monitoring

```bash
arduino-cli compile --fqbn esp32:esp32:esp32 .
arduino-cli upload -p /dev/ttyUSB0 --fqbn esp32:esp32:esp32 .
arduino-cli monitor -p /dev/ttyUSB0 -c baudrate=115200
```

## Network Notes

- Ensure your computer and the ESP32 are on the same WiFi network.
- Default MQTT port: 1883

