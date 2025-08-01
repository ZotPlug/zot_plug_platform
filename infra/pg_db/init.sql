CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,                                            -- Auto-incrementing user ID
  firstname VARCHAR(64) NOT NULL,                                   -- User's firstname (required)
  lastname VARCHAR(64) NOT NULL,                                    -- User's last name (required)
  middlename VARCHAR(64),                                           -- Optional middle name
  username VARCHAR(64) NOT NULL UNIQUE,                             -- Unique login username per user
  email VARCHAR(64) NOT NULL UNIQUE,                                -- Unique email (used for login/auth or notifications)
  email_verified BOOLEAN DEFAULT FALSE,                             -- Email verification (auth security)
  phone VARCHAR(15),                                                -- Optional phone number                
  password_hash TEXT NOT NULL,                                      -- Hashed password string
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                   -- Timestamp of account creation
  role VARCHAR(16) NOT NULL DEFAULT 'guest'                         -- Global role for user
    CHECK (role IN ('guest', 'admin'))                              -- Limits role values to valid choices
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,                                            -- Auto-incrementing device ID
  name VARCHAR(128) NOT NULL UNIQUE,                                -- Human-readable user-defined device name
  mqtt_username TEXT NOT NULL UNIQUE,                               -- MQTT client username used for auth (e.g., "zot_plug_000001")
  password_hash TEXT NOT NULL,                                      -- MQTT password hash (for secure auth to broker)
  allowed_publish TEXT[],                                           -- Array of MQTT topics this device is allowed to publish to
  allowed_subscribe TEXT[],                                         -- Array of MQTT topics this device is allowed to subcribe to
  -- mqtt_topic VARCHAR(128) NOT NULL UNIQUE,                       -- Default topic for each device
  status VARCHAR(32) DEFAULT 'offline'                  
    CHECK (status IN ('online', 'offline', 'error')),               -- Track live connectivity status           
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                -- Time the device was registered (could be changed to date)
  last_seen TIMESTAMP                                               -- When the device last communicated (updated by broker)
);

-- Classifies a M:N relationship between users and devices
CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER 
    REFERENCES users(id) ON DELETE CASCADE,                         -- Foreign key to users
  device_id INTEGER 
    REFERENCES devices(id) ON DELETE CASCADE,                       -- Foreign key to devices
  role VARCHAR(16) DEFAULT 'viewer'                                 -- Device-level role
    CHECK (role IN ('owner', 'viewer', 'editor')),                  -- Limits role types per device
  status VARCHAR(16) DEFAULT 'active' 
    CHECK (status IN ('active', 'pending', 'revoked')),             -- Tracks invite status or permission revocation
  invited_at TIMESTAMP,                                             -- When the user was invited to share this device
  accepted_at TIMESTAMP,                                            -- When the user accepted the invite                                  
  PRIMARY KEY (user_id, device_id)
);

/*
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,                                            -- Auto-incrementing user ID
  firstname VARCHAR(64) NOT NULL,                                   -- User's firstname (required)
  lastname VARCHAR(64) NOT NULL,                                    -- User's last name (required)
  username VARCHAR(64) NOT NULL UNIQUE,                             -- Unique username (used for login/auth)
  email VARCHAR(64) NOT NULL UNIQUE,                                -- Unique email (used for login/auth or alerts)
  email_verified BOOLEAN DEFAULT FALSE,                             -- Email verification (auth security)
  phone VARCHAR(15),                                                -- Optional phone number (may be used for MFA/alerts)               
  password_hash TEXT NOT NULL,                                      -- Hashed password (never store plaintext)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                   -- Timestamp of account creation (default = now)
  role VARCHAR(16) NOT NULL DEFAULT 'guest'                         -- Global role for access control
    CHECK (role IN ('guest', 'admin'))                              -- Limits role values to valid choices
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,                                            -- Auto-incrementing device ID
  name VARCHAR(128) NOT NULL UNIQUE,                                -- Human-readable device name (user-defined)
  mqtt_username TEXT NOT NULL UNIQUE,                               -- Unique MQTT client username used by device for broker auth (e.g., "zot_plug_000001")
  password_hash TEXT NOT NULL,                                      -- Hashed MQTT password for secure broker login 
  status VARCHAR(32) DEFAULT 'offline'                              -- Device's online state; default = offline
    CHECK (status IN ('online', 'offline', 'error')),               -- Valid status values only           
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                -- Timestamp of when the device was registered (could be changed to date)
  last_seen TIMESTAMP                                               -- Timestamp of last communication with the broker
);

CREATE TABLE device_allowed_publish (
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,       -- Device ID (foreign key)
  topic TEXT NOT NULL,                                              -- MQTT topic the device can publish to
  PRIMARY KEY (device_id, topic)                                    -- Ensures no duplicates for (device, topic)
);

CREATE TABLE device_allowed_subscribe (
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,       -- Device ID (foreign key)
  topic TEXT NOT NULL,                                              -- MQTT topic the device can subscribe to 
  PRIMARY KEY (device_id, topic)                                    -- Ensures uniqueness
);

CREATE TABLE device_topics (
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,       -- Device ID (foreign key)
  topic TEXT NOT NULL,                                              -- Topic the device can access
  can_publish BOOLEAN DEFAULT FALSE,                                -- Whether device can publish to this topic
  can_subscribe BOOLEAN DEFAULT FALSE,                              -- Whether device can subscribe to this topic
  PRIMARY KEY (device_id, topic)                                    -- Enforces unique topic per device
);

-- Classifies a M:N relationship between users and devices
CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,           -- User ID (foreign key)
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,       -- Device ID (foreign key)
  role VARCHAR(16) DEFAULT 'viewer'                                 -- Role this user has for this device
    CHECK (role IN ('owner', 'viewer', 'editor')),                  -- Limits to specific role values
  status VARCHAR(16) DEFAULT 'active'                               -- Invitation/permission status
    CHECK (status IN ('active', 'pending', 'revoked')),             -- Valid statuses only
  invited_at TIMESTAMP,                                             -- When the user was invited to this device
  accepted_at TIMESTAMP,                                            -- When the user accepted the invite                            
  PRIMARY KEY (user_id, device_id)                                  -- Prevents duplicate links between same user/device
);
*/