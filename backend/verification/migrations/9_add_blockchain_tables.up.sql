CREATE TABLE IF NOT EXISTS blockchain_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  device_id TEXT NOT NULL,
  transaction_hash TEXT UNIQUE NOT NULL,
  block_number BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  data JSONB NOT NULL,
  merkle_root TEXT NOT NULL,
  merkle_proof JSONB,
  data_hash TEXT NOT NULL,
  verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS blockchain_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;

CREATE INDEX idx_blockchain_records_device ON blockchain_records(device_id);
CREATE INDEX idx_blockchain_records_tx_hash ON blockchain_records(transaction_hash);
CREATE INDEX idx_blockchain_records_event_type ON blockchain_records(event_type);
CREATE INDEX idx_blockchain_records_created ON blockchain_records(created_at);
CREATE INDEX idx_devices_blockchain_verified ON devices(blockchain_verified);
