import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface GenerateLinkRequest {
  deviceId: number;
  expiryHours?: number;
  partnerName?: string;
}

export interface GenerateLinkResponse {
  verificationLink: string;
  expiresAt: Date;
  linkId: string;
}

// Generates a public verification link for a device.
export const generateLink = api<GenerateLinkRequest, GenerateLinkResponse>(
  { expose: true, method: "POST", path: "/generate-link" },
  async (req) => {
    const { deviceId, expiryHours = 24, partnerName } = req;

    // Generate unique link ID
    const linkId = `vl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + (expiryHours * 60 * 60 * 1000));

    // Store link in database (you might want to create a verification_links table)
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${deviceId}, 'link_generated', ${`Verification link generated (expires: ${expiresAt.toISOString()})`}, ${partnerName || 'STOLEN'}, true)
    `;

    // In a real implementation, you'd store the link details in a separate table
    // For now, we'll just generate the link format
    const verificationLink = `https://stolen-verify.app/verify/${linkId}?device=${deviceId}`;

    return {
      verificationLink,
      expiresAt,
      linkId,
    };
  }
);
