import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { verificationDB } from "./db";

export interface SearchDevicesRequest {
  query: Query<string>;
  limit?: Query<number>;
}

export interface SearchResult {
  id: number;
  serialNumber: string;
  deviceName: string;
  model: string;
  brand: string;
  status: string;
  imageUrl?: string;
}

export interface SearchDevicesResponse {
  devices: SearchResult[];
  total: number;
}

// Searches for devices by name, model, or brand.
export const search = api<SearchDevicesRequest, SearchDevicesResponse>(
  { expose: true, method: "GET", path: "/search" },
  async (req) => {
    const { query, limit = 20 } = req;
    const searchTerm = `%${query}%`;

    const devices = await verificationDB.queryAll<{
      id: number;
      serial_number: string;
      device_name: string;
      model: string;
      brand: string;
      status: string;
      image_url?: string;
    }>`
      SELECT id, serial_number, device_name, model, brand, status, image_url
      FROM devices 
      WHERE device_name ILIKE ${searchTerm} 
         OR model ILIKE ${searchTerm} 
         OR brand ILIKE ${searchTerm}
      ORDER BY device_name
      LIMIT ${limit}
    `;

    const totalResult = await verificationDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM devices 
      WHERE device_name ILIKE ${searchTerm} 
         OR model ILIKE ${searchTerm} 
         OR brand ILIKE ${searchTerm}
    `;

    return {
      devices: devices.map(device => ({
        id: device.id,
        serialNumber: device.serial_number,
        deviceName: device.device_name,
        model: device.model,
        brand: device.brand,
        status: device.status,
        imageUrl: device.image_url,
      })),
      total: totalResult?.count || 0,
    };
  }
);
