import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface SeedDataResponse {
  message: string;
  devicesCreated: number;
}

// Seeds the database with sample data for testing.
export const seed = api<void, SeedDataResponse>(
  { expose: true, method: "POST", path: "/seed" },
  async () => {
    // Sample devices
    const devices = [
      {
        serial: "SN123456789",
        imei: "123456789012345",
        name: "iPhone 14 Pro",
        model: "A2894",
        brand: "Apple",
        imageUrl: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400",
        status: "clean"
      },
      {
        serial: "SN987654321",
        imei: "987654321098765",
        name: "Samsung Galaxy S23",
        model: "SM-S911B",
        brand: "Samsung",
        imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
        status: "flagged"
      },
      {
        serial: "SN456789123",
        imei: "456789123456789",
        name: "Google Pixel 7",
        model: "GVU6C",
        brand: "Google",
        imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400",
        status: "under_investigation"
      }
    ];

    let devicesCreated = 0;

    for (const device of devices) {
      // Insert device
      const deviceResult = await verificationDB.queryRow<{ id: number }>`
        INSERT INTO devices (serial_number, imei, device_name, model, brand, image_url, status, current_trust_score, risk_category)
        VALUES (${device.serial}, ${device.imei}, ${device.name}, ${device.model}, ${device.brand}, ${device.imageUrl}, ${device.status}, 75, 'medium')
        ON CONFLICT (serial_number) DO NOTHING
        RETURNING id
      `;

      if (deviceResult) {
        devicesCreated++;
        const deviceId = deviceResult.id;

        // Insert ownership history
        await verificationDB.exec`
          INSERT INTO ownership_history (device_id, owner_alias, owner_type, verification_level, location_country, is_current_owner)
          VALUES (${deviceId}, 'John Doe', 'individual', 'verified', 'South Africa', true)
        `;

        // Insert some events
        await verificationDB.exec`
          INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
          VALUES 
            (${deviceId}, 'registration', 'Device registered in STOLEN system', 'STOLEN', true),
            (${deviceId}, 'purchase', 'Purchased from authorized retailer', 'TechStore SA', true)
        `;

        // Insert trust score
        await verificationDB.exec`
          INSERT INTO trust_scores (device_id, score, risk_category, ownership_continuity_score, history_completeness_score, repair_history_score, dispute_penalty)
          VALUES (${deviceId}, 75, 'medium', 20, 16, 15, 0)
          ON CONFLICT (device_id) DO UPDATE SET
            score = EXCLUDED.score,
            risk_category = EXCLUDED.risk_category,
            ownership_continuity_score = EXCLUDED.ownership_continuity_score,
            history_completeness_score = EXCLUDED.history_completeness_score,
            repair_history_score = EXCLUDED.repair_history_score,
            dispute_penalty = EXCLUDED.dispute_penalty,
            calculated_at = CURRENT_TIMESTAMP
        `;

        // Add device fingerprint for some devices
        if (device.serial === "SN123456789") {
          await verificationDB.exec`
            INSERT INTO device_fingerprints (device_id, fingerprint_hash, sensor_patterns, cpu_gpu_id, mac_addresses)
            VALUES (${deviceId}, 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456', 
                    '{"accelerometer": [1.2, 3.4, 5.6], "gyroscope": [0.1, 0.2, 0.3]}', 
                    'A15_BIONIC_GPU_001', 
                    '["00:1B:44:11:3A:B7", "02:1B:44:11:3A:B8"]')
            ON CONFLICT (device_id) DO NOTHING
          `;
        }

        // Add a report for flagged device
        if (device.status === "flagged") {
          await verificationDB.exec`
            INSERT INTO reports (device_id, reporter_alias, report_type, description, status)
            VALUES (${deviceId}, 'Anonymous', 'stolen', 'Device reported stolen from vehicle', 'verified')
          `;
        }
      }
    }

    // Insert sample partners for law enforcement testing
    await verificationDB.exec`
      INSERT INTO partners (name, api_key, partner_type, contact_email, is_active)
      VALUES 
        ('SAPS Cybercrime Unit', 'le_key_saps_001', 'law_enforcement', 'cybercrime@saps.gov.za', true),
        ('Insurance Fraud Unit', 'le_key_ifu_001', 'law_enforcement', 'fraud@insurance.co.za', true)
      ON CONFLICT (api_key) DO NOTHING
    `;

    return {
      message: "Sample data seeded successfully with advanced features",
      devicesCreated,
    };
  }
);
