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
        INSERT INTO devices (serial_number, imei, device_name, model, brand, image_url, status)
        VALUES (${device.serial}, ${device.imei}, ${device.name}, ${device.model}, ${device.brand}, ${device.imageUrl}, ${device.status})
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

        // Add a report for flagged device
        if (device.status === "flagged") {
          await verificationDB.exec`
            INSERT INTO reports (device_id, reporter_alias, report_type, description, status)
            VALUES (${deviceId}, 'Anonymous', 'stolen', 'Device reported stolen from vehicle', 'verified')
          `;
        }
      }
    }

    return {
      message: "Sample data seeded successfully",
      devicesCreated,
    };
  }
);
