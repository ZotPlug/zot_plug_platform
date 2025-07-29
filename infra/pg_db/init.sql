CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firstname VARCHAR(64) NOT NULL,
  lastname VARCHAR(64) NOT NULL,
  middlename VARCHAR(64),
  username VARCHAR(128) NOT NULL UNIQUE,
  email VARCHAR(128) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(16) DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  allowed_publish TEXT[],
  allowed_subscribe TEXT[],
  mqtt_topic VARCHAR(128) NOT NULL UNIQUE,
  status VARCHAR(32) DEFAULT 'offline',
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_device_map (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
  role VARCHAR(16) DEFAULT 'owner',
  PRIMARY KEY (user_id, device_id)
);