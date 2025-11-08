/*
===========================================================================
ZotPlug Platform – PostgreSQL Database Schema
===========================================================================

OVERVIEW:
This schema defines the relational data model for the ZotPlug IoT 
platform — a secure, scalable, and maintainable backend that supports
real-time monitoring and management of potentially thousands of 
smart plug devices and users. 

DESIGN PRINCIPLES:
- Separation of Concerns:
  * User profile data is isolated from authentication credentials.
  * Device metadata is separated from authentication keys.
  * Global roles users (system-wide) are distinct per-device role.

- Normalization (up to BCNF):
  * Eliminates redundancy and update anomalies by ensuring each fact
    is stored in exactly one place (table).
  * Many-to-many relationships are resolved via junction tables.
  
- Security:
  * Authentication credentials are stored in dedicated tables with 
    restricted access. 
  * Role-based access control (RBAC) models both global and device
    -specific permissions. 
  * Access control is modeled through explicit role and permission tables.
  * Audit logs ensure traceability of key platform actions. 

- Scalability:
  * Indexed high-cardinality and frequently filtered columns for efficient 
    querying.
  * JSONB columns support flexible, schema-less metadata without rewrites.
  * Soft-delete flags allow archival without physically removing records.

- Maintainability:
  * Consistent table naming conventions and logical grouping of concerns.
  * Use of ON DELETE CASCADE for clean removal of dependent records.
  * CHECK constraints ensure domain-specific data validity. 
===========================================================================
*/


CREATE EXTENSION IF NOT EXISTS pgcrypto;                                      -- Enables pgcrypto functions (e.g., gen_random_uuid) for UUIDs & crypto ops

-- =========================================================
-- USERS 
-- Stores user profile info only - authentication data is kept 
-- in a separate table for better separation of concerns. 
-- =========================================================
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,                                                      -- Auto-incrementing user ID
  firstname VARCHAR(64) NOT NULL,                                             -- User's firstname (required)
  lastname VARCHAR(64) NOT NULL,                                              -- User's lastname (required)
  username VARCHAR(64) NOT NULL UNIQUE,                                       -- Login/display name (unique)
  email VARCHAR(64) NOT NULL UNIQUE,                                          -- Unique email (for login/auth or notifications)
  email_verified BOOLEAN DEFAULT FALSE,                                       -- Email verification (auth security)
  phone VARCHAR(15),                                                          -- Optional phone number
  is_deleted BOOLEAN DEFAULT FALSE,                                           -- Soft-delete flag (true if account is removed)
  deleted_at TIMESTAMP                                                        -- Timestamp when user was soft-deleted
);


-- =========================================================
-- AUTH_CREDENTIALS
-- Stores authentication secrets and MFA data, separated
-- from profile data for security isolation.
-- =========================================================
DROP TABLE IF EXISTS auth_credentials CASCADE;
CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,         -- FK to user (1:1 mapping)
  password_hash TEXT NOT NULL,                                                -- Hashed password
  mfa_secret TEXT,                                                            -- Optional MFA secret (e.g., TOTP key)
  last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP                    -- Audit of last password change
);


-- =========================================================
-- USER_CREATION_INFO
-- Tracks how and when each user was created. 
-- =========================================================
DROP TABLE IF EXISTS user_creation_info CASCADE;
CREATE TABLE IF NOT EXISTS user_creation_info (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,         -- FK to user (1:1 mapping)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                             -- Timestamp of creation
  creation_ip INET,                                                           -- IP address of creator
  method VARCHAR(32)                                                          -- Method of creation (e.g., 'manual', 'invite')
);

-- =========================================================
-- SYSTEM_ROLES
-- System-wide global role definitions for authorization (RBAC).
-- =========================================================
DROP TABLE IF EXISTS system_roles CASCADE;
CREATE TABLE IF NOT EXISTS system_roles (
  id SERIAL PRIMARY KEY,                                                      -- Role ID
  role VARCHAR(32) NOT NULL DEFAULT 'user'                                    -- Role name
    CHECK (role IN ('admin', 'support', 'user')),
  description TEXT                                                            -- Role description
);


-- ========================================================= 
-- USER_ROLES 
-- M:N mapping of users to system-wide global roles. 
-- ========================================================= 
DROP TABLE IF EXISTS user_roles CASCADE;
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,                     -- FK to user
  role_id INTEGER REFERENCES system_roles(id) ON DELETE CASCADE,              -- FK to system_roles
  PRIMARY KEY (user_id, role_id)                                              -- Composite PK avoids duplicates
);


-- =========================================================
-- USER_SESSIONS
-- Tracks active user sessions for security and auditing.
-- =========================================================
DROP TABLE IF EXISTS user_sessions CASCADE;
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                      -- Unique session ID (UUID from pgcrypto)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,            -- User owning the session
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                             -- When session was created
  expires_at TIMESTAMP NOT NULL,                                              -- Session expiry time
  ip_address INET,                                                            -- IP address of client 
  user_agent TEXT,                                                            -- Client's user agent string
  is_active BOOLEAN DEFAULT TRUE,                                             -- Mark inactive to force logout
  revoked_at TIMESTAMP                                                        -- When session was revoked 
);


-- =========================================================
-- AUDIT LOGS
-- Tracks actions performed on entities for audit purposes. 
-- =========================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,                                                      -- Log entry ID
  entity_type VARCHAR(32) NOT NULL,                                           -- Type of entity (e.g., 'user', 'device', 'topic', etc.)
  entity_id TEXT NOT NULL,                                                    -- ID of affected entity 
  action VARCHAR(64) NOT NULL,                                                -- Action performed 
  performed_by INTEGER REFERENCES users(id),                                  -- FK to user who performed action
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                              -- When the action occurred
  details JSONB                                                               -- Additional info as JSON
);


-- =========================================================
-- DEVICES 
-- Registry of all devices in the system. 
-- =========================================================
DROP TABLE IF EXISTS devices CASCADE;
CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,                                                      -- Device ID
  name VARCHAR(128) NOT NULL UNIQUE,                                          -- Unique device name
  status VARCHAR(32) DEFAULT 'offline'                                        -- Current device state
    CHECK (status IN ('online', 'offline', 'error')),                         
  last_seen TIMESTAMP,                                                        -- Last heartbeat/ping
  is_deleted BOOLEAN DEFAULT FALSE,                                           -- Soft-delete flag
  deleted_at TIMESTAMP                                                        -- When device was soft-deleted
);


-- =========================================================
-- DEVICES_CREDENTIALS 
-- Authentication credentials for MQTT or other protocols. 
-- =========================================================
DROP TABLE IF EXISTS device_credentials CASCADE;
CREATE TABLE IF NOT EXISTS device_credentials (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,     -- FK to device (1:1 mapping)
  mqtt_username TEXT NOT NULL UNIQUE,                                         -- MQTT username
  password_hash TEXT NOT NULL,                                                -- Hashed password for MQTT
  last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP                    -- Last password change timestamp
);


-- =========================================================
-- DEVICE_REGISTRATION_INFO
-- Tracks how and when each device was registered.
-- =========================================================
DROP TABLE IF EXISTS device_registration_info CASCADE;
CREATE TABLE IF NOT EXISTS device_registration_info (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,     -- FK to device
  registered_by INTEGER REFERENCES users(id),                                 -- FK to registering user
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                          -- Timestamp of registration
  registration_ip INET,                                                       -- IP address of registration
  tool_used TEXT                                                              -- Tool used to register (e.g., CLI, web UI)
);


-- =========================================================
-- POWER_READINGS
-- Stores real-time and historical power usage metrics per device.
-- =========================================================
DROP TABLE IF EXISTS power_readings CASCADE;
CREATE TABLE IF NOT EXISTS power_readings (
  id BIGSERIAL PRIMARY KEY,                                                   -- Metric entry ID
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,                 -- FK to device
  voltage FlOAT CHECK (voltage >= 0),                                         -- Measured voltage (V)
  current FLOAT CHECK (current >= 0),                                         -- Measured current (A)
  power FLOAT GENERATED ALWAYS AS (voltage * current) STORED,                 -- Instantaneous power (W)
  cumulative_energy FLOAT DEFAULT 0 CHECK (cumulative_energy >= 0),           -- Cumulative energy (kWh)
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                             -- When the reading was taken
);


-- =========================================================
-- DEVICE_ENERGY_STATS
-- Aggregated energy usage per device over defined time periods.
-- =========================================================
DROP TABLE IF EXISTS device_energy_stats CASCADE;
CREATE TABLE IF NOT EXISTS device_energy_stats (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,              -- FK to device
  period_type VARCHAR(16) NOT NULL 
    CHECK (period_type IN ('daily','weekly','monthly')),
  period_start DATE NOT NULL,                                              -- Start of the period (e.g., '2025-11-08')
  total_energy FLOAT DEFAULT 0 CHECK (total_energy >= 0),                  -- Total Wh in period
  avg_power FLOAT DEFAULT 0 CHECK (avg_power >= 0),                        -- Mean power (optional)
  max_power FLOAT DEFAULT 0 CHECK (max_power >= 0),                        -- Peak power
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                          -- Last recalculation
  UNIQUE (device_id, period_type, period_start)                            -- Avoid duplicates
);


-- =========================================================
-- DEVICES_METADATA
-- Optional extended metadata for devices. 
-- =========================================================
DROP TABLE IF EXISTS device_metadata CASCADE;
CREATE TABLE IF NOT EXISTS device_metadata (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,     -- FK to device (1:1 mapping)
  image_url TEXT,                                                             -- URL to device image
  firmware_version VARCHAR(64),                                               -- Firmware version
  model VARCHAR(64),                                                          -- Model name/number  
  software_version VARCHAR(64),                                               -- Software version
  hw_capabilities JSONB                                                       -- JSON of hardware capabilities (for varied device types)
);


-- =========================================================
-- DEVICE_POLICIES
-- Defines custom usage restrictions or automation rules.
-- =========================================================
DROP TABLE IF EXISTS device_policies CASCADE;
CREATE TABLE IF NOT EXISTS device_policies (
  id BIGSERIAL PRIMARY KEY,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  daily_energy_limit FLOAT CHECK (daily_energy_limit >= 0),                -- Wh limit per day
  allowed_start TIME,                                                      -- Earliest allowed operation time
  allowed_end TIME,                                                        -- Latest allowed operation time
  is_enforced BOOLEAN DEFAULT TRUE,                                        -- Whether policy is active
  last_violation TIMESTAMP,                                                -- Last time limit was exceeded
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- DEVICE_TOPIC_PERMISSIONS
-- Permissions for publish/subscribe per device topic. 
-- =========================================================
DROP TABLE IF EXISTS device_topic_permissions CASCADE;
CREATE TABLE IF NOT EXISTS device_topic_permissions (
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,                 -- FK to device
  topic TEXT NOT NULL,                                                        -- MQTT topic
  can_publish BOOLEAN DEFAULT FALSE,                                          -- Publish permission
  can_subscribe BOOLEAN DEFAULT FALSE,                                        -- Subscribe permission
  PRIMARY KEY (device_id, topic)                                              -- Unique topic per device
);


-- =========================================================
-- DEVICES_ROLES
-- Role definitions for per-device permissions. 
-- =========================================================
DROP TABLE IF EXISTS device_roles CASCADE;
CREATE TABLE IF NOT EXISTS device_roles (
  id SERIAL PRIMARY KEY,                                                      -- Device role ID
  role VARCHAR(32) NOT NULL DEFAULT 'guest'                                   -- Role name
    CHECK (role IN ('owner', 'guest', 'viewer')),
  description TEXT                                                            -- Role description
);


-- =========================================================
-- USER_DEVICE_MAP
-- M:N mapping of users to devices with role assignments. 
-- =========================================================
DROP TABLE IF EXISTS user_device_map CASCADE;
CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,                     -- FK to user
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,                 -- FK to device
  role_id INTEGER REFERENCES device_roles(id) ON DELETE CASCADE,              -- FK to device role
  status VARCHAR(16) DEFAULT 'active'                                         -- Link status
    CHECK (status IN ('active', 'pending', 'revoked')),
  invited_at TIMESTAMP,                                                       -- Invitation sent timestamp
  accepted_at TIMESTAMP,                                                      -- Invitation accepted timestamp
  PRIMARY KEY (user_id, device_id)                                            -- Composite PK ensures uniqueness
);



-- =========================================================
-- INDEXES (Performance Optimization)
-- =========================================================

-- =========================================================
-- USERS & AUTHENTICATION
-- =========================================================
CREATE UNIQUE INDEX idx_users_email ON users(email);                         -- Fast login/email lookups (unique)
CREATE UNIQUE INDEX idx_users_username ON users(username);                   -- Fast login/username lookups (unique)
CREATE INDEX idx_users_active ON users(id) 
  WHERE is_deleted = FALSE;                                                  -- Filter for active (non-deleted) users
CREATE INDEX idx_auth_last_pw_change 
  ON auth_credentials(last_password_change);                                 -- Track recent password change events

-- =========================================================
-- DEVICES & DEVICE CREDENTIALS
-- =========================================================
CREATE UNIQUE INDEX idx_device_credentials_mqtt_username 
  ON device_credentials(mqtt_username);                                      -- MQTT authentication lookup
CREATE INDEX idx_devices_active 
  ON devices(id) 
  WHERE is_deleted = FALSE;                                                  -- Filter for active devices (ignores deleted)
CREATE INDEX idx_device_last_seen 
  ON devices(last_seen);                                                     -- Useful for listing recently active devices

-- =========================================================
-- USER–DEVICE RELATIONSHIPS
-- =========================================================
CREATE INDEX idx_user_device_map_user_id 
  ON user_device_map(user_id);                                               -- Find all devices linked to a user
CREATE INDEX idx_user_device_map_device_id 
  ON user_device_map(device_id);                                             -- Find all users linked to a device

-- =========================================================
-- TOPIC PERMISSIONS
-- =========================================================
CREATE INDEX idx_topic_permissions_topic 
  ON device_topic_permissions(topic);                                        -- Efficient topic-based permission checks

-- =========================================================
-- USER SESSIONS
-- =========================================================
CREATE INDEX idx_user_sessions_user_id 
  ON user_sessions(user_id);                                                 -- Lookup sessions for a user
CREATE INDEX idx_user_sessions_active 
  ON user_sessions(is_active) 
  WHERE is_active = TRUE;                                                    -- Filter active sessions (for logout checks)

-- =========================================================
-- POWER READINGS (time-series data)
-- =========================================================
CREATE INDEX idx_power_device_time_desc 
  ON power_readings(device_id, recorded_at DESC);                            -- Fast retrieval of latest readings per device
CREATE INDEX idx_power_recorded_at 
  ON power_readings(recorded_at);                                            -- Global time-based queries or cleanup jobs
-- (Optional) For very large datasets, consider partitioning + BRIN on recorded_at
-- CREATE INDEX idx_power_recorded_at_brin ON power_readings USING BRIN (recorded_at);

-- =========================================================
-- ENERGY STATISTICS (aggregates)
-- =========================================================
CREATE UNIQUE INDEX idx_energy_device_period 
  ON device_energy_stats(device_id, period_type, period_start);              -- Ensure one record per device per period
CREATE INDEX idx_energy_period_start 
  ON device_energy_stats(period_start);                                      -- Filter/aggregate by date range

-- =========================================================
-- DEVICE POLICIES
-- =========================================================
CREATE INDEX idx_policy_device 
  ON device_policies(device_id);                                             -- Find policies per device
CREATE INDEX idx_policy_device_active 
  ON device_policies(device_id) 
  WHERE is_enforced = TRUE;                                                  -- Fast lookup for enforced/active policies

-- =========================================================
-- AUDIT LOGS (optional but useful for admin tools)
-- =========================================================
CREATE INDEX idx_audit_entity_time 
  ON audit_logs(entity_type, timestamp DESC);                                -- Filter recent actions by entity type
CREATE INDEX idx_audit_performed_by 
  ON audit_logs(performed_by);                                               -- List actions performed by a specific user
-- CREATE INDEX idx_audit_details_gin 
--   ON audit_logs USING GIN (details);                                      -- (Optional) Enables JSONB search inside 'details'
