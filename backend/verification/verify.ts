import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";

export interface VerifyDeviceRequest {
  identifier: string;
  identifierType: "serial" | "imei";
}

export interface DeviceInfo {
  id: number;
  serialNumber: string;
  imei?: string;
  deviceName: string;
  model: string;
  brand: string;
  imageUrl?: string;
  status: "clean" | "flagged" | "under_investigation";
  lastVerified: Date;
}

export interface OwnershipInfo {
  ownerAlias: string;
  ownerType: string;
  verificationLevel: "basic" | "verified" | "business";
  transferDate: Date;
  locationCountry?: string;
  isCurrentOwner: boolean;
}

export interface DeviceEvent {
  id: number;
  eventType: string;
  eventDescription?: string;
  eventDate: Date;
  providerName?: string;
  verified: boolean;
}

export interface VerifyDeviceResponse {
  device: DeviceInfo;
  currentOwner?: OwnershipInfo;
  ownershipHistory: OwnershipInfo[];
  events: DeviceEvent[];
  reportCount: number;
}

// Verifies a device by serial number or IMEI.
export const verify = api<VerifyDeviceRequest, VerifyDeviceResponse>(
  { expose: true, method: "POST", path: "/verify" },
  async (req) => {
    const { identifier, identifierType } = req;

    // Find device by identifier
    const whereClause = identifierType === "serial" 
      ? "serial_number = $1" 
      : "imei = $1";
    
    const device = await verificationDB.queryRow<{
      id: number;
      serial_number: string;
      imei?: string;
      device_name: string;
      model: string;
      brand: string;
      image_url?: string;
      status: string;
      updated_at: Date;
    }>`
      SELECT id, serial_number, imei, device_name, model, brand, image_url, status, updated_at
      FROM devices 
      WHERE ${verificationDB.rawQuery(whereClause, identifier)}
    `.then(result => result);

    if (!device) {
      throw APIError.notFound("Device not found");
    }

    // Get ownership history
    const ownershipHistory = await verificationDB.queryAll<{
      owner_alias: string;
      owner_type: string;
      verification_level: string;
      transfer_date: Date;
      location_country?: string;
      is_current_owner: boolean;
    }>`
      SELECT owner_alias, owner_type, verification_level, transfer_date, location_country, is_current_owner
      FROM ownership_history 
      WHERE device_id = ${device.id}
      ORDER BY transfer_date DESC
    `;

    // Get device events
    const events = await verificationDB.queryAll<{
      id: number;
      event_type: string;
      event_description?: string;
      event_date: Date;
      provider_name?: string;
      verified: boolean;
    }>`
      SELECT id, event_type, event_description, event_date, provider_name, verified
      FROM device_events 
      WHERE device_id = ${device.id}
      ORDER BY event_date DESC
    `;

    // Get report count
    const reportResult = await verificationDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM reports 
      WHERE device_id = ${device.id}
    `;

    const currentOwner = ownershipHistory.find(owner => owner.is_current_owner);

    return {
      device: {
        id: device.id,
        serialNumber: device.serial_number,
        imei: device.imei,
        deviceName: device.device_name,
        model: device.model,
        brand: device.brand,
        imageUrl: device.image_url,
        status: device.status as "clean" | "flagged" | "under_investigation",
        lastVerified: device.updated_at,
      },
      currentOwner: currentOwner ? {
        ownerAlias: currentOwner.owner_alias,
        ownerType: currentOwner.owner_type,
        verificationLevel: currentOwner.verification_level as "basic" | "verified" | "business",
        transferDate: currentOwner.transfer_date,
        locationCountry: currentOwner.location_country,
        isCurrentOwner: currentOwner.is_current_owner,
      } : undefined,
      ownershipHistory: ownershipHistory.map(owner => ({
        ownerAlias: owner.owner_alias,
        ownerType: owner.owner_type,
        verificationLevel: owner.verification_level as "basic" | "verified" | "business",
        transferDate: owner.transfer_date,
        locationCountry: owner.location_country,
        isCurrentOwner: owner.is_current_owner,
      })),
      events: events.map(event => ({
        id: event.id,
        eventType: event.event_type,
        eventDescription: event.event_description,
        eventDate: event.event_date,
        providerName: event.provider_name,
        verified: event.verified,
      })),
      reportCount: reportResult?.count || 0,
    };
  }
);
