CREATE INDEX IF NOT EXISTS idx_devices_imei_status ON devices(imei, status);
CREATE INDEX IF NOT EXISTS idx_devices_created_at ON devices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_logs_device_created ON verification_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_device_created ON reports(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_history_device_date ON ownership_history(device_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_device_events_device_date ON device_events(device_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_events_device_date ON lifecycle_events(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_scores_device ON trust_scores(device_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_watchers_email ON device_watchers(user_email);
CREATE INDEX IF NOT EXISTS idx_partner_api_keys_key ON partner_api_keys(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_devices_composite_search ON devices(status, trust_score, verification_count);
CREATE INDEX IF NOT EXISTS idx_devices_updated_status ON devices(updated_at DESC, status);
