CREATE TABLE partners (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE NOT NULL,
  partner_type VARCHAR(100) NOT NULL, -- marketplace, insurer, law_enforcement, etc.
  contact_email VARCHAR(255) NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification_logs (
  id BIGSERIAL PRIMARY KEY,
  partner_id BIGINT REFERENCES partners(id),
  device_id BIGINT REFERENCES devices(id),
  verification_type VARCHAR(50) NOT NULL, -- single, batch
  identifier_used VARCHAR(255) NOT NULL,
  identifier_type VARCHAR(50) NOT NULL,
  result_status VARCHAR(50) NOT NULL, -- found, not_found, error
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification_links (
  id BIGSERIAL PRIMARY KEY,
  link_id VARCHAR(255) UNIQUE NOT NULL,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  partner_id BIGINT REFERENCES partners(id),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  access_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_partners_api_key ON partners(api_key);
CREATE INDEX idx_verification_logs_partner ON verification_logs(partner_id);
CREATE INDEX idx_verification_logs_device ON verification_logs(device_id);
CREATE INDEX idx_verification_logs_created ON verification_logs(created_at);
CREATE INDEX idx_verification_links_link_id ON verification_links(link_id);
CREATE INDEX idx_verification_links_expires ON verification_links(expires_at);
