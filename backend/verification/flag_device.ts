import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";

export interface FlagDeviceRequest {
  deviceId: number;
  flagType: "stolen" | "fraud" | "tampered" | "fake" | "suspicious";
  reason: string;
  flaggedBy: string;
  partnerName?: string;
}

export interface FlagDeviceResponse {
  flagId: number;
  deviceStatus: string;
  message: string;
}

// Flags a device as suspicious or problematic.
export const flagDevice = api<FlagDeviceRequest, FlagDeviceResponse>(
  { expose: true, method: "POST", path: "/device/:deviceId/flag" },
  async (req) => {
    const { deviceId, flagType, reason, flaggedBy, partnerName } = req;

    // Check if device exists
    const device = await verificationDB.queryRow<{ id: number; status: string }>`
      SELECT id, status FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw APIError.notFound("Device not found");
    }

    // Insert flag record
    const flagResult = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO reports (device_id, reporter_alias, report_type, description, status)
      VALUES (${deviceId}, ${flaggedBy}, ${flagType}, ${reason}, 'pending')
      RETURNING id
    `;

    // Update device status based on flag severity
    let newStatus = device.status;
    if (flagType === "stolen" || flagType === "fraud") {
      newStatus = "flagged";
    } else if (flagType === "suspicious" || flagType === "tampered") {
      newStatus = "under_investigation";
    }

    if (newStatus !== device.status) {
      await verificationDB.exec`
        UPDATE devices 
        SET status = ${newStatus}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${deviceId}
      `;
    }

    // Log the flagging event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${deviceId}, 'flagged', ${`Device flagged as ${flagType}: ${reason}`}, ${partnerName || 'STOLEN'}, true)
    `;

    return {
      flagId: flagResult!.id,
      deviceStatus: newStatus,
      message: `Device successfully flagged as ${flagType}`,
    };
  }
);
