CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

CREATE INDEX IF NOT EXISTS idx_devices_manufacturer ON devices(manufacturer);
CREATE INDEX IF NOT EXISTS idx_devices_model ON devices(model);
CREATE INDEX IF NOT EXISTS idx_devices_trust_score ON devices(trust_score);
CREATE INDEX IF NOT EXISTS idx_devices_verification_count ON devices(verification_count);
CREATE INDEX IF NOT EXISTS idx_devices_status_updated ON devices(status, updated_at);
