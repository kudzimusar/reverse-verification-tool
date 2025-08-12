CREATE TABLE product_lifecycle (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  event_category VARCHAR(100) NOT NULL, -- ownership, repair, insurance, warranty, police, theft
  event_data JSONB NOT NULL,
  event_source VARCHAR(255) NOT NULL, -- partner name or system
  verification_level VARCHAR(50) NOT NULL DEFAULT 'unverified', -- verified, unverified, disputed
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification_badges (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  badge_id VARCHAR(255) UNIQUE NOT NULL,
  partner_id BIGINT REFERENCES partners(id),
  badge_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, premium, marketplace
  is_active BOOLEAN DEFAULT true,
  click_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP
);

CREATE TABLE lifecycle_access_logs (
  id BIGSERIAL PRIMARY KEY,
  badge_id VARCHAR(255) REFERENCES verification_badges(badge_id),
  device_id BIGINT REFERENCES devices(id),
  access_type VARCHAR(50) NOT NULL, -- badge_click, direct_link, api_request
  ip_address INET,
  user_agent TEXT,
  referrer_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seller_profiles (
  id BIGSERIAL PRIMARY KEY,
  seller_alias VARCHAR(255) NOT NULL,
  seller_type VARCHAR(50) NOT NULL DEFAULT 'individual', -- individual, business, dealer
  verification_level VARCHAR(50) NOT NULL DEFAULT 'basic', -- basic, verified, premium
  reputation_score INTEGER DEFAULT 50,
  total_sales INTEGER DEFAULT 0,
  contact_method VARCHAR(50), -- email, phone, platform_message
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_warranties (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  warranty_provider VARCHAR(255) NOT NULL,
  warranty_type VARCHAR(100) NOT NULL, -- manufacturer, extended, insurance
  coverage_details JSONB,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  claim_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE insurance_records (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  insurance_provider VARCHAR(255) NOT NULL,
  policy_number VARCHAR(255),
  coverage_amount DECIMAL(10,2),
  premium_amount DECIMAL(10,2),
  start_date DATE NOT NULL,
  end_date DATE,
  claim_history JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repair_records (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  repair_shop VARCHAR(255) NOT NULL,
  repair_type VARCHAR(100) NOT NULL, -- screen, battery, water_damage, etc
  repair_description TEXT,
  repair_cost DECIMAL(10,2),
  parts_replaced TEXT[],
  repair_date DATE NOT NULL,
  warranty_period_days INTEGER DEFAULT 0,
  is_authorized_repair BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_product_lifecycle_device ON product_lifecycle(device_id);
CREATE INDEX idx_product_lifecycle_category ON product_lifecycle(event_category);
CREATE INDEX idx_verification_badges_device ON verification_badges(device_id);
CREATE INDEX idx_verification_badges_badge_id ON verification_badges(badge_id);
CREATE INDEX idx_lifecycle_access_logs_badge ON lifecycle_access_logs(badge_id);
CREATE INDEX idx_product_warranties_device ON product_warranties(device_id);
CREATE INDEX idx_insurance_records_device ON insurance_records(device_id);
CREATE INDEX idx_repair_records_device ON repair_records(device_id);
CREATE INDEX idx_seller_profiles_alias ON seller_profiles(seller_alias);

-- Add lifecycle summary to devices table
ALTER TABLE devices ADD COLUMN lifecycle_summary JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN verification_badge_count INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN last_lifecycle_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
