import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";
import { getCachedDevice, setCachedDevice } from "./cache";

export interface GetDeviceRequest {
  id: number;
}

export interface GetDeviceResponse {
  device: {
    id: number;
    serialNumber: string;
    imei?: string;
    deviceName: string;
    model: string;
    brand: string;
    imageUrl?: string;
    status: "clean" | "flagged" | "under_investigation";
    lastVerified: Date;
  };
  currentOwner?: {
    ownerAlias: string;
    ownerType: string;
    verificationLevel: "basic" | "verified" | "business";
    transferDate: Date;
    locationCountry?: string;
    isCurrentOwner: boolean;
  };
  ownershipHistory: Array<{
    ownerAlias: string;
    ownerType: string;
    verificationLevel: "basic" | "verified" | "business";
    transferDate: Date;
    locationCountry?: string;
    isCurrentOwner: boolean;
  }>;
  events: Array<{
    id: number;
    eventType: string;
    eventDescription?: string;
    eventDate: Date;
    providerName?: string;
    verified: boolean;
  }>;
  reportCount: number;
}

// Gets detailed device information by ID.
export const getDevice = api<GetDeviceRequest, GetDeviceResponse>(
  { expose: true, method: "GET", path: "/device/:id" },
  async (req) => {
    const { id } = req;

    const cachedDevice = await getCachedDevice(id.toString());
    if (cachedDevice) {
      const ownershipHistory = await verificationDB.queryAll`
        SELECT owner_alias, owner_type, verification_level, transfer_date, location_country, is_current_owner
        FROM ownership_history 
        WHERE device_id = ${id}
        ORDER BY transfer_date DESC
      `;

      const events = await verificationDB.queryAll`
        SELECT id, event_type, event_description, event_date, provider_name, verified
        FROM device_events 
        WHERE device_id = ${id}
        ORDER BY event_date DESC
      `;

      const reportResult = await verificationDB.queryRow`
        SELECT COUNT(*) as count
        FROM reports 
        WHERE device_id = ${id}
      `;

      return {
        device: {
          id: parseInt(cachedDevice.id),
          serialNumber: cachedDevice.imei,
          imei: cachedDevice.imei,
          deviceName: cachedDevice.manufacturer || "Unknown",
          model: cachedDevice.model || "Unknown",
          brand: cachedDevice.manufacturer || "Unknown",
          status: cachedDevice.status as any,
          lastVerified: cachedDevice.updatedAt,
        },
        currentOwner: ownershipHistory.find(o => o.is_current_owner) ? {
          ownerAlias: ownershipHistory.find(o => o.is_current_owner)!.owner_alias,
          ownerType: ownershipHistory.find(o => o.is_current_owner)!.owner_type,
          verificationLevel: ownershipHistory.find(o => o.is_current_owner)!.verification_level as any,
          transferDate: ownershipHistory.find(o => o.is_current_owner)!.transfer_date,
          locationCountry: ownershipHistory.find(o => o.is_current_owner)!.location_country,
          isCurrentOwner: true,
        } : undefined,
        ownershipHistory: ownershipHistory.map(o => ({
          ownerAlias: o.owner_alias,
          ownerType: o.owner_type,
          verificationLevel: o.verification_level as any,
          transferDate: o.transfer_date,
          locationCountry: o.location_country,
          isCurrentOwner: o.is_current_owner,
        })),
        events: events.map(e => ({
          id: e.id,
          eventType: e.event_type,
          eventDescription: e.event_description,
          eventDate: e.event_date,
          providerName: e.provider_name,
          verified: e.verified,
        })),
        reportCount: reportResult?.count || 0,
      };
    }

    // Find device by ID
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
      WHERE id = ${id}
    `;

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

    await setCachedDevice(id.toString(), {
      id: id.toString(),
      imei: device.imei || device.serial_number,
      status: device.status,
      manufacturer: device.brand,
      model: device.model,
      trustScore: 0,
      verificationCount: 0,
      reportCount: reportResult?.count || 0,
      updatedAt: device.updated_at,
    });

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
