CREATE TABLE IF NOT EXISTS marketplace_listings (
  id BIGSERIAL PRIMARY KEY,
  listing_id TEXT UNIQUE NOT NULL,
  device_imei TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  price DECIMAL(10, 2),
  verification_status TEXT DEFAULT 'pending',
  block_listing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  device_imei TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketplace_listings_imei ON marketplace_listings(device_imei);
CREATE INDEX idx_marketplace_listings_seller ON marketplace_listings(seller_id);
CREATE INDEX idx_marketplace_listings_marketplace ON marketplace_listings(marketplace);
CREATE INDEX idx_marketplace_events_listing ON marketplace_events(listing_id);
CREATE INDEX idx_marketplace_events_type ON marketplace_events(event_type);
