# Welcome to ZotPlug

![ZotPlug Backend](./images/readme_backend.jpg)

Welcome to ZotPlug! This is the server infrastructure and firmware for our smart plug IoT solution. 

## Project Poster & Technical Report

![ZotPlug Poster](./images/EECS%20159B%20-%20Final%20Project%20Poster.jpg)

- The full resolution PDF version of the project poster can be found [here](https://drive.google.com/file/d/1YAu_NmLsX2b73EIh_0wYKdVRCQuiZaFI/view?usp=sharing).
- The technical report for this project can be found [here](https://drive.google.com/file/d/1xXkfRifxrVSe8xIGHvAEyg9sbYb6Ol6m/view?usp=drive_link).

## About the Project

University dormitories experience significant energy waste because many electronic devices remain plugged in and idle for extended periods of time. 
Studies estimate that these energy vampires account for nearly 30% of unnecessary energy consumption in dormitory environments. 
To address this issue, we developed ZotPlug, a smart outlet system designed to monitor and control energy usage at the individual outlet level. 
ZotPlug measures real-time energy consumption using a dedicated power metering integrated circuit connected to an ESP32 microcontroller and transmits telemetry to a cloud-based platform.
Through a dashboard application, we enabled users to visualize energy usage, remotely-control connected devices, and configure scheduling features that promote more efficient electricity use. 
The platform also incorporated behavioral incentives that encourage students to reduce consumption through friendly competition and usage awareness. 
Our experimental evaluation demonstrated that the system could obtain accurate measurements within 5% of the expected values across a wide range of device loads. 
Ultimately, we showed that ZotPlug can provide reliable outlet-level energy monitoring and seamlessly integrated into a scalable cloud system with an intuitive user interface while supporting UC Irvine’s long-term sustainability goals.

## Diagrams & Architecture

### Software

#### Infrastructure
![Infra Diagram](./images/infra.jpg)

The system consists of a user-friendly web and mobile interface, a scalable cloud infrastructure, and server logic that allows ZotPlug devices to communicate with the backend server over MQTT.

#### Authentication Provision
![Provision Workflow](./images/auth_provision.jpg)

Here is a breakdown of the authentication communication process for web and mobile users.

## Database
![Database](./images/database.png)

Here is an ER diagram of our server database. Users are mapped to ZotPlug devices and can interact with them in various ways.

### Hardware

![Hardware Schematic](./images/phase2_schematic.png)

Our finalized circuit schematic utilized an ESP32, a dedicated metering IC, and a relay switch. This design served as the basis for our perfboard and PCB implementations.

## Development
Please see our [Getting Started](./SETUP.md) instructions.
