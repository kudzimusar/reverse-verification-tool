CREATE TABLE trust_scores (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_category VARCHAR(20) NOT NULL CHECK (risk_category IN ('low', 'medium', 'high')),
  ownership_continuity_score INTEGER DEFAULT 0,
  history_completeness_score INTEGER DEFAULT 0,
  repair_history_score INTEGER DEFAULT 0,
  dispute_penalty INTEGER DEFAULT 0,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id)
);

CREATE TABLE device_fingerprints (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(64) UNIQUE NOT NULL,
  sensor_patterns JSONB,
  cpu_gpu_id VARCHAR(255),
  mac_addresses TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id)
);

CREATE TABLE verification_nodes (
  id BIGSERIAL PRIMARY KEY,
  node_name VARCHAR(255) NOT NULL,
  node_type VARCHAR(100) NOT NULL, -- stolen, police, insurer, manufacturer
  endpoint_url TEXT NOT NULL,
  api_key_hash VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification_audit (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  verification_request_id VARCHAR(255) NOT NULL,
  node_id BIGINT REFERENCES verification_nodes(id),
  node_response JSONB NOT NULL,
  response_status VARCHAR(50) NOT NULL, -- success, failure, timeout
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_watchers (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  user_phone VARCHAR(50),
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": false}',
  last_notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, user_email)
);

CREATE TABLE notification_logs (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  watcher_id BIGINT REFERENCES device_watchers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- status_change, trust_score_drop
  message TEXT NOT NULL,
  delivery_method VARCHAR(20) NOT NULL, -- email, sms, push
  delivery_status VARCHAR(20) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE zkp_proofs (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  proof_hash VARCHAR(128) NOT NULL,
  verification_hash VARCHAR(128) NOT NULL,
  owner_commitment VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE law_enforcement_reports (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  reporter_id BIGINT REFERENCES partners(id),
  report_type VARCHAR(100) NOT NULL,
  jurisdiction VARCHAR(100) NOT NULL,
  case_number VARCHAR(255),
  encrypted_data TEXT NOT NULL,
  encryption_key_hash VARCHAR(128) NOT NULL,
  blockchain_proof_hash VARCHAR(128),
  status VARCHAR(50) DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_trust_scores_device ON trust_scores(device_id);
CREATE INDEX idx_trust_scores_score ON trust_scores(score);
CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_verification_audit_device ON verification_audit(device_id);
CREATE INDEX idx_verification_audit_request ON verification_audit(verification_request_id);
CREATE INDEX idx_device_watchers_device ON device_watchers(device_id);
CREATE INDEX idx_device_watchers_email ON device_watchers(user_email);
CREATE INDEX idx_notification_logs_device ON notification_logs(device_id);
CREATE INDEX idx_zkp_proofs_device ON zkp_proofs(device_id);
CREATE INDEX idx_law_enforcement_device ON law_enforcement_reports(device_id);

-- Add trust score to devices table
ALTER TABLE devices ADD COLUMN current_trust_score INTEGER DEFAULT 50;
ALTER TABLE devices ADD COLUMN risk_category VARCHAR(20) DEFAULT 'medium';

-- Insert sample verification nodes
INSERT INTO verification_nodes (node_name, node_type, endpoint_url, is_active, priority) VALUES
('STOLEN Primary Node', 'stolen', 'https://api.stolen-blockchain.com/verify', true, 1),
('Police Database Node', 'police', 'https://api.police-db.gov/verify', true, 2),
('Insurance Registry Node', 'insurer', 'https://api.insurance-registry.com/verify', true, 3),
('Manufacturer Node', 'manufacturer', 'https://api.device-manufacturers.com/verify', true, 4);
