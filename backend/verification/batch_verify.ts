import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface BatchVerifyRequest {
  devices: Array<{
    identifier: string;
    identifierType: "serial" | "imei";
  }>;
}

export interface BatchVerifyResult {
  identifier: string;
  identifierType: "serial" | "imei";
  found: boolean;
  device?: {
    id: number;
    serialNumber: string;
    imei?: string;
    deviceName: string;
    model: string;
    brand: string;
    status: "clean" | "flagged" | "under_investigation";
    lastVerified: Date;
  };
  reportCount?: number;
}

export interface BatchVerifyResponse {
  results: BatchVerifyResult[];
  totalProcessed: number;
  totalFound: number;
}

// Verifies multiple devices in a single request.
export const batchVerify = api<BatchVerifyRequest, BatchVerifyResponse>(
  { expose: true, method: "POST", path: "/verify/batch" },
  async (req) => {
    const { devices } = req;
    const results: BatchVerifyResult[] = [];

    for (const deviceRequest of devices) {
      const { identifier, identifierType } = deviceRequest;

      try {
        // Find device by identifier
        const device = await verificationDB.queryRow<{
          id: number;
          serial_number: string;
          imei?: string;
          device_name: string;
          model: string;
          brand: string;
          status: string;
          updated_at: Date;
        }>`
          SELECT id, serial_number, imei, device_name, model, brand, status, updated_at
          FROM devices 
          WHERE ${identifierType === 'serial' ? 'serial_number' : 'imei'} = ${identifier}
        `;

        if (!device) {
          results.push({
            identifier,
            identifierType,
            found: false,
          });
          continue;
        }

        // Get report count
        const reportResult = await verificationDB.queryRow<{ count: number }>`
          SELECT COUNT(*) as count
          FROM reports 
          WHERE device_id = ${device.id}
        `;

        results.push({
          identifier,
          identifierType,
          found: true,
          device: {
            id: device.id,
            serialNumber: device.serial_number,
            imei: device.imei,
            deviceName: device.device_name,
            model: device.model,
            brand: device.brand,
            status: device.status as "clean" | "flagged" | "under_investigation",
            lastVerified: device.updated_at,
          },
          reportCount: reportResult?.count || 0,
        });
      } catch (error) {
        results.push({
          identifier,
          identifierType,
          found: false,
        });
      }
    }

    const totalFound = results.filter(r => r.found).length;

    return {
      results,
      totalProcessed: devices.length,
      totalFound,
    };
  }
);
