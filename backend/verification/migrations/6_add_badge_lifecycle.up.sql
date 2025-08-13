-- Drop existing verification_badges table if it exists with wrong schema
DROP TABLE IF EXISTS verification_badges CASCADE;

-- Drop existing verification_history table if it exists
DROP TABLE IF EXISTS verification_history CASCADE;

-- Create verification_badges table
CREATE TABLE verification_badges (
  id BIGSERIAL PRIMARY KEY,
  entity_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'revoked', 'expired')),
  verified_by VARCHAR(255),
  method VARCHAR(20) CHECK (method IN ('manual', 'automated', 'third_party')),
  issued_at TIMESTAMP,
  expiry_date TIMESTAMP,
  revoked_at TIMESTAMP,
  revocation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_id)
);

-- Create verification_history table
CREATE TABLE verification_history (
  id BIGSERIAL PRIMARY KEY,
  entity_id BIGINT REFERENCES devices(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'verified', 'revoked', 'expired', 'extended')),
  verified_by VARCHAR(255),
  method VARCHAR(20) CHECK (method IN ('manual', 'automated', 'third_party')),
  notes TEXT,
  reason TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_verification_badges_entity ON verification_badges(entity_id);
CREATE INDEX idx_verification_badges_status ON verification_badges(status);
CREATE INDEX idx_verification_badges_expiry ON verification_badges(expiry_date);
CREATE INDEX idx_verification_history_entity ON verification_history(entity_id);
CREATE INDEX idx_verification_history_timestamp ON verification_history(timestamp);

-- Add verification badge info to devices table if columns don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'has_verification_badge') THEN
    ALTER TABLE devices ADD COLUMN has_verification_badge BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'badge_status') THEN
    ALTER TABLE devices ADD COLUMN badge_status VARCHAR(20) DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'badge_issued_at') THEN
    ALTER TABLE devices ADD COLUMN badge_issued_at TIMESTAMP;
  END IF;
END $$;

-- Update existing devices to reflect badge status
UPDATE devices SET has_verification_badge = false, badge_status = 'pending' 
WHERE has_verification_badge IS NULL OR badge_status IS NULL;
