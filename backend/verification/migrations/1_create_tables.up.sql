CREATE TABLE devices (
  id BIGSERIAL PRIMARY KEY,
  serial_number VARCHAR(255) UNIQUE NOT NULL,
  imei VARCHAR(255),
  device_name VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  image_url TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'clean',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ownership_history (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  owner_alias VARCHAR(255) NOT NULL,
  owner_type VARCHAR(50) NOT NULL DEFAULT 'individual',
  verification_level VARCHAR(50) NOT NULL DEFAULT 'basic',
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  location_country VARCHAR(100),
  is_current_owner BOOLEAN DEFAULT false
);

CREATE TABLE device_events (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  event_description TEXT,
  event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  provider_name VARCHAR(255),
  verified BOOLEAN DEFAULT false
);

CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  reporter_alias VARCHAR(255) NOT NULL,
  report_type VARCHAR(100) NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_serial ON devices(serial_number);
CREATE INDEX idx_devices_imei ON devices(imei);
CREATE INDEX idx_ownership_device ON ownership_history(device_id);
CREATE INDEX idx_events_device ON device_events(device_id);
CREATE INDEX idx_reports_device ON reports(device_id);
