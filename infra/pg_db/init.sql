/*
============================================================
ZotPlug Platform – PostgreSQL Database Schema
============================================================

OVERVIEW:
This schema defines the relational data model for the ZotPlug IoT
platform, designed for secure, scalable, and maintainable operation
with potentially thousands of users and devices.

DESIGN PRINCIPLES:
- Separation of Concerns:
  * User profile data is stored separately from authentication credentials.
  * Device metadata is separated from device authentication credentials.
  * Global roles (system-wide) are distinct from device roles (per-device).

- Normalization (up to BCNF):
  * Eliminates redundancy and update anomalies by ensuring each fact
    is stored in exactly one place.
  * Many-to-many relationships are resolved via junction tables.
  
- Security:
  * Credentials are stored in dedicated tables to limit access and exposure.
  * Access control is modeled through explicit role and permission tables.
  * Audit logging for traceability of important actions.

- Scalability:
  * Indexed high-cardinality and frequently filtered columns for fast lookups.
  * Flexible JSONB columns for extensible metadata without schema rewrites.
  * Soft-delete fields allow archival without physically removing records.

- Maintainability:
  * Consistent table naming conventions and logical grouping of concerns.
  * Use of ON DELETE CASCADE for clean removal of dependent records.
  * CHECK constraints to enforce domain validity.
============================================================
*/


CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- USERS (Profile info only - no authentication data here)
-- =========================================================
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firstname VARCHAR(64) NOT NULL,
  lastname VARCHAR(64) NOT NULL,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(64) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  phone VARCHAR(15),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP
);

DROP TABLE IF EXISTS user_sessions;
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Requires pgcrypto extension
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,        -- For forced logout
  revoked_at TIMESTAMP
);

-- =========================================================
-- AUTHENTICATION (separate table for credentials/security)
-- =========================================================
DROP TABLE IF EXISTS auth_credentials;
CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  mfa_secret TEXT,            -- optional for multi-factor authentication
  last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- GLOBAL ROLES (system-wide permissions)
-- =========================================================
DROP TABLE IF EXISTS global_roles;
CREATE TABLE IF NOT EXISTS global_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE,   -- e.g., 'admin', 'support'
  description TEXT
);

-- M:N mapping of users to global roles
DROP TABLE IF EXISTS user_global_roles;
CREATE TABLE IF NOT EXISTS user_global_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES global_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- =========================================================
-- DEVICES (basic device registry)
-- =========================================================
DROP TABLE IF EXISTS devices;
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(32) DEFAULT 'offline'                              -- Device's online state; default = offline
    CHECK (status IN ('online', 'offline', 'error')),
  last_seen TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP
);

DROP TABLE IF EXISTS device_credentials;
CREATE TABLE IF NOT EXISTS device_credentials (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  mqtt_username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- DEVICES METADATA (expandable attributes)
-- =========================================================
DROP TABLE IF EXISTS device_metadata;
CREATE TABLE IF NOT EXISTS device_metadata (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  firmware_version VARCHAR(64),
  model VARCHAR(64),
  software_version VARCHAR(64),
  hw_capabilities JSONB -- flexible storage for varied device types
);

-- =========================================================
-- DEVICES ROLES (per-device permissions)
-- =========================================================
DROP TABLE IF EXISTS device_roles;
CREATE TABLE IF NOT EXISTS device_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE, -- e.g., 'owner', 'viewer', 'maintainer'
  description TEXT
);

-- M:N mapping of users to devices with roles
DROP TABLE IF EXISTS user_device_map;
CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES device_roles(id) ON DELETE CASCADE,
  status VARCHAR(16) DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'revoked')),
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  PRIMARY KEY (user_id, device_id)
);

-- =========================================================
-- TOPIC PERMISSIONS (unified publish/subscribe table)
-- =========================================================
DROP TABLE IF EXISTS device_topic_permissions;
CREATE TABLE IF NOT EXISTS device_topic_permissions (
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  can_publish BOOLEAN DEFAULT FALSE,
  can_subscribe BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (device_id, topic)
);

-- =========================================================
-- AUDIT LOGS (flexible action history)
-- =========================================================
DROP TABLE IF EXISTS audit_logs;
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL, -- 'user', 'device', 'topic', etc.
  entity_id INTEGER NOT NULL,
  action VARCHAR(64) NOT NULL,
  performed_by INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

-- =========================================================
-- CREATION/REGISTRATION INFO
-- =========================================================
DROP TABLE IF EXISTS user_creation_info;
CREATE TABLE IF NOT EXISTS user_creation_info (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  creation_ip INET,
  method VARCHAR(32)
);

DROP TABLE IF EXISTS device_registration_info;
CREATE TABLE IF NOT EXISTS device_registration_info (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  registered_by INTEGER REFERENCES users(id),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  registration_ip INET,
  tool_used TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_device_credentials_mqtt_username ON device_credentials(mqtt_username);
CREATE INDEX idx_user_device_map_user_id ON user_device_map(user_id);
CREATE INDEX idx_user_device_map_device_id ON user_device_map(device_id);
CREATE INDEX idx_topic_permissions_topic ON device_topic_permissions(topic);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);



/*
--First working version

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
  status VARCHAR(32) DEFAULT 'offline'                  
    CHECK (status IN ('online', 'offline', 'error')),               -- Track live connectivity status           
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                -- Time the device was registered (could be changed to date)
  last_seen TIMESTAMP                                               -- When the device last communicated (updated by broker)
);

-- Classifies a M:N relationship between users and devices
CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,                         -- Foreign key to users
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,                       -- Foreign key to devices
  role VARCHAR(16) DEFAULT 'viewer'                                 -- Device-level role
    CHECK (role IN ('owner', 'viewer', 'editor')),                  -- Limits role types per device
  status VARCHAR(16) DEFAULT 'active' 
    CHECK (status IN ('active', 'pending', 'revoked')),             -- Tracks invite status or permission revocation
  invited_at TIMESTAMP,                                             -- When the user was invited to share this device
  accepted_at TIMESTAMP,                                            -- When the user accepted the invite                                  
  PRIMARY KEY (user_id, device_id)
);

*/