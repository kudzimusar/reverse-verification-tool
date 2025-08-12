import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface SeedDataResponse {
  message: string;
  devicesCreated: number;
}

// Seeds the database with a diverse set of sample data for testing.
export const seed = api<void, SeedDataResponse>(
  { expose: true, method: "POST", path: "/seed" },
  async () => {
    // Sample devices with diverse serial number formats
    const devices = [
      // Simple Numeric
      { serial: "1000000001", imei: "111000000000001", name: "Generic Phone A", model: "GPA-10", brand: "NumericBrand", imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", status: "clean" },
      { serial: "1000000002", imei: "111000000000002", name: "Generic Tablet A", model: "GTA-10", brand: "NumericBrand", imageUrl: "https://images.unsplash.com/photo-1561154464-82e9964def74?w=400", status: "clean" },

      // Alphanumeric
      { serial: "SN-AB1X-2024", imei: "222000000000001", name: "Alpha Pro", model: "AP-2024", brand: "AlphaNum Inc.", imageUrl: "https://images.unsplash.com/photo-1604671368394-22ae7d543944?w=400", status: "flagged" },
      { serial: "SN-CD2Y-2024", imei: "222000000000002", name: "Alpha Max", model: "AM-2024", brand: "AlphaNum Inc.", imageUrl: "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400", status: "clean" },

      // UUIDs
      { serial: "550e8400-e29b-41d4-a716-446655440000", imei: "333000000000001", name: "UUID Device 1", model: "UUID-1", brand: "Unique Systems", imageUrl: "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=400", status: "under_investigation" },
      { serial: "6ba7b810-9dad-11d1-80b4-00c04fd430c8", imei: "333000000000002", name: "UUID Device 2", model: "UUID-2", brand: "Unique Systems", imageUrl: "https://images.unsplash.com/photo-1616348436168-de43ad0db179?w=400", status: "clean" },

      // Product Key Format
      { serial: "3K7N-9P2Q-R4T6-Y8U1", imei: "444000000000001", name: "KeyPad 5000", model: "KP-5K", brand: "KeyBrand", imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400", status: "clean" },
      { serial: "5W2X-4M6L-8V9B-3C1D", imei: "444000000000002", name: "KeyPad Pro", model: "KP-PRO", brand: "KeyBrand", imageUrl: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=400", status: "clean" },

      // Short Codes
      { serial: "A1B2C3", imei: "555000000000001", name: "Shorty S1", model: "S1", brand: "CodeCo", imageUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400", status: "clean" },
      { serial: "X7Y9Z4", imei: "555000000000002", name: "Shorty S2", model: "S2", brand: "CodeCo", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400", status: "flagged" },
      
      // Original test devices for specific scenarios
      { serial: "SN123456789", imei: "123456789012345", name: "iPhone 14 Pro", model: "A2894", brand: "Apple", imageUrl: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400", status: "clean" },
      { serial: "SN987654321", imei: "987654321098765", name: "Samsung Galaxy S23", model: "SM-S911B", brand: "Samsung", imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400", status: "flagged" },
      { serial: "SN456789123", imei: "456789123456789", name: "Google Pixel 7", model: "GVU6C", brand: "Google", imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", status: "under_investigation" }
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
        if (device.serial === "SN123456789" || device.serial === "550e8400-e29b-41d4-a716-446655440000") {
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

        // Add sample lifecycle events
        await verificationDB.exec`
          INSERT INTO product_lifecycle (device_id, event_category, event_data, event_source, verification_level)
          VALUES 
            (${deviceId}, 'ownership', '{"purchaseDate": "2024-01-01", "retailer": "TechStore SA", "price": 999}', 'TechStore SA', 'verified'),
            (${deviceId}, 'warranty', '{"provider": "Manufacturer", "startDate": "2024-01-01", "endDate": "2025-01-01"}', 'Apple', 'verified')
        `;

        // Add sample repair record for some devices
        if (device.serial === "SN123456789") {
          await verificationDB.exec`
            INSERT INTO repair_records (device_id, repair_shop, repair_type, repair_description, repair_cost, repair_date, warranty_period_days, is_authorized_repair)
            VALUES (${deviceId}, 'iStore Cape Town', 'screen', 'Screen replacement due to crack', 299.99, '2024-06-15', 90, true)
          `;
        }

        // Add sample warranty
        await verificationDB.exec`
          INSERT INTO product_warranties (device_id, warranty_provider, warranty_type, start_date, end_date, is_active)
          VALUES (${deviceId}, 'Apple Inc.', 'manufacturer', '2024-01-01', '2025-01-01', true)
          ON CONFLICT DO NOTHING
        `;
      }
    }

    // Insert sample partners for law enforcement testing
    await verificationDB.exec`
      INSERT INTO partners (name, api_key, partner_type, contact_email, is_active)
      VALUES 
        ('SAPS Cybercrime Unit', 'le_key_saps_001', 'law_enforcement', 'cybercrime@saps.gov.za', true),
        ('Insurance Fraud Unit', 'le_key_ifu_001', 'law_enforcement', 'fraud@insurance.co.za', true),
        ('TechStore SA', 'partner_key_techstore_001', 'marketplace', 'api@techstore.co.za', true),
        ('Gumtree', 'partner_key_gumtree_001', 'marketplace', 'api@gumtree.co.za', true)
      ON CONFLICT (api_key) DO NOTHING
    `;

    // Insert sample seller profiles
    await verificationDB.exec`
      INSERT INTO seller_profiles (seller_alias, seller_type, verification_level, contact_method, reputation_score, total_sales)
      VALUES 
        ('TechDealer_SA', 'business', 'premium', 'email', 95, 150),
        ('JohnDoe_CT', 'individual', 'verified', 'platform_message', 78, 12),
        ('ElectronicsHub', 'dealer', 'premium', 'email', 88, 89)
      ON CONFLICT (seller_alias) DO NOTHING
    `;

    return {
      message: "Sample data seeded successfully with diverse serial number formats and lifecycle features",
      devicesCreated,
    };
  }
);
