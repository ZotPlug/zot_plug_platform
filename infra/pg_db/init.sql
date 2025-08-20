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
-- SYSTEM_ROLES
-- System-wide role definitions for authorization (RBAC).
-- M:N mapping of users to system-wide global roles.
-- =========================================================
DROP TABLE IF EXISTS system_roles CASCADE;
CREATE TABLE IF NOT EXISTS system_roles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,         -- FK to user
  role_name VARCHAR(32) NOT NULL DEFAULT 'user'                               -- Role name
    CHECK (role_name IN ('admin', 'support', 'user')),
  description TEXT                                                            -- Optional description for role
);

-- DELETE

-- =========================================================
-- GLOBAL_ROLES
-- System-wide role definitions for authorization (RBAC).
-- =========================================================
DROP TABLE IF EXISTS global_roles CASCADE;
CREATE TABLE IF NOT EXISTS global_roles (
  id SERIAL PRIMARY KEY,                                                      -- Role ID
  name VARCHAR(32) NOT NULL UNIQUE,                                           -- Role name (e.g., 'admin', 'support')
  description TEXT                                                            -- Optional human-readable description
);

-- DELETE

-- =========================================================
-- USER_GLOBAL_ROLES
-- M:N mapping of users to global roles. 
-- =========================================================
DROP TABLE IF EXISTS user_global_roles CASCADE;
CREATE TABLE IF NOT EXISTS user_global_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,                     -- FK to user
  role_id INTEGER REFERENCES global_roles(id) ON DELETE CASCADE,              -- FK to role
  PRIMARY KEY (user_id, role_id)                                              -- Composite PK avoids duplicates
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
-- DEVICES_METADATA
-- Optional extended metadata for devices. 
-- =========================================================
DROP TABLE IF EXISTS device_metadata CASCADE;
CREATE TABLE IF NOT EXISTS device_metadata (
  device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,     -- FK to device (1:1 mapping)
  firmware_version VARCHAR(64),                                               -- Firmware version
  model VARCHAR(64),                                                          -- Model name/number  
  software_version VARCHAR(64),                                               -- Software version
  hw_capabilities JSONB                                                       -- JSON of hardware capabilities (for varied device types)
);



-- =========================================================
-- DEVICES_ROLES
-- Role definitions for per-device permissions. 
-- =========================================================
DROP TABLE IF EXISTS device_roles CASCADE;
CREATE TABLE IF NOT EXISTS device_roles (
  id SERIAL PRIMARY KEY,                                                      -- Device role ID
  name VARCHAR(32) NOT NULL UNIQUE,                                           -- Role name (e.g., 'owner', 'viewer', 'maintainer')
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
-- AUDIT LOGS
-- Tracks actions performed on entities for audit purposes. 
-- =========================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,                                                      -- Log entry ID
  entity_type VARCHAR(32) NOT NULL,                                           -- Type of entity (e.g., 'user', 'device', 'topic', etc.)
  entity_id INTEGER NOT NULL,                                                 -- ID of affected entity 
  action VARCHAR(64) NOT NULL,                                                -- Action performed 
  performed_by INTEGER REFERENCES users(id),                                  -- FK to user who performed action
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                              -- When the action occurred
  details JSONB                                                               -- Additional info as JSON
);



-- =========================================================
-- USER_CREATION_INFO
-- Tracks how and when each user was created. 
-- =========================================================
DROP TABLE IF EXISTS user_creation_info CASCADE;
CREATE TABLE IF NOT EXISTS user_creation_info (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,         -- FK to user
  created_by INTEGER REFERENCES users(id),                                    -- FK to creator (nullable for self-signup)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                             -- Timestamp of creation
  creation_ip INET,                                                           -- IP address of creator
  method VARCHAR(32)                                                          -- Method of creation (e.g., 'manual', 'invite')
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
-- INDEXES (Performance Optimization)
-- =========================================================
CREATE INDEX idx_users_email ON users(email);                                                   -- Lookup by email
CREATE INDEX idx_users_username ON users(username);                                             -- Lookup by username
CREATE INDEX idx_device_credentials_mqtt_username ON device_credentials(mqtt_username);         -- MQTT auth lookup 
CREATE INDEX idx_user_device_map_user_id ON user_device_map(user_id);                           -- Device by user
CREATE INDEX idx_user_device_map_device_id ON user_device_map(device_id);                       -- User by device
CREATE INDEX idx_topic_permissions_topic ON device_topic_permissions(topic);                    -- Topic-based lookup
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);                               -- Sessions by user
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);                              -- Active sessions filter