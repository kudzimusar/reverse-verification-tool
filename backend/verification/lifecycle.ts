import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface AddLifecycleEventRequest {
  deviceId: number;
  eventCategory: "ownership" | "repair" | "insurance" | "warranty" | "police" | "theft";
  eventData: any;
  eventSource: string;
  verificationLevel?: "verified" | "unverified" | "disputed";
  isPublic?: boolean;
}

export interface AddLifecycleEventResponse {
  eventId: number;
  message: string;
}

// Adds a lifecycle event to a device's history.
export const addLifecycleEvent = api<AddLifecycleEventRequest, AddLifecycleEventResponse>(
  { expose: true, method: "POST", path: "/lifecycle/add-event" },
  async (req) => {
    const { 
      deviceId, 
      eventCategory, 
      eventData, 
      eventSource, 
      verificationLevel = "unverified",
      isPublic = true 
    } = req;

    // Verify device exists
    const device = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Insert lifecycle event
    const result = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO product_lifecycle (
        device_id, event_category, event_data, event_source, 
        verification_level, is_public
      ) VALUES (
        ${deviceId}, ${eventCategory}, ${JSON.stringify(eventData)}, 
        ${eventSource}, ${verificationLevel}, ${isPublic}
      )
      RETURNING id
    `;

    // Update device lifecycle summary
    await updateLifecycleSummary(deviceId);

    // Log the event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${deviceId}, 'lifecycle_event', 
              ${`${eventCategory} event added by ${eventSource}`}, 
              ${verificationLevel === 'verified'})
    `;

    return {
      eventId: result!.id,
      message: `Lifecycle event added successfully`,
    };
  }
);

export interface GetLifecycleRequest {
  badgeId?: string;
  deviceId?: number;
  includePrivate?: boolean;
}

export interface LifecycleEvent {
  id: number;
  category: string;
  data: any;
  source: string;
  verificationLevel: string;
  timestamp: Date;
}

export interface LifecycleSummary {
  totalEvents: number;
  ownershipChanges: number;
  repairCount: number;
  insuranceClaims: number;
  warrantyStatus: string;
  policeReports: number;
  lastUpdate: Date;
}

export interface GetLifecycleResponse {
  device: {
    id: number;
    name: string;
    brand: string;
    model: string;
    serialNumber: string;
    status: string;
    trustScore?: number;
    imageUrl?: string;
  };
  currentOwner?: {
    alias: string;
    type: string;
    verificationLevel: string;
    since: Date;
    location?: string;
  };
  lifecycle: {
    summary: LifecycleSummary;
    events: LifecycleEvent[];
    ownership: Array<{
      owner: string;
      type: string;
      from: Date;
      to?: Date;
      verificationLevel: string;
      location?: string;
    }>;
    repairs: Array<{
      shop: string;
      type: string;
      description: string;
      cost?: number;
      date: Date;
      warranty: number;
      authorized: boolean;
    }>;
    warranties: Array<{
      provider: string;
      type: string;
      startDate: Date;
      endDate: Date;
      isActive: boolean;
      claimCount: number;
    }>;
    insurance: Array<{
      provider: string;
      policyNumber?: string;
      coverage?: number;
      startDate: Date;
      endDate?: Date;
      isActive: boolean;
      claims: any[];
    }>;
  };
  badge?: {
    id: string;
    type: string;
    clickCount: number;
    createdAt: Date;
  };
  accessMetadata: {
    accessId: string;
    timestamp: Date;
    isPublicAccess: boolean;
  };
}

// Gets complete lifecycle information for a device via badge or device ID.
export const getLifecycle = api(
  { expose: true, method: "GET", path: "/lifecycle/:badgeId" },
  async (req: GetLifecycleRequest): Promise<GetLifecycleResponse> => {
    const { badgeId, deviceId, includePrivate = false } = req;
    
    let targetDeviceId = deviceId;
    let badgeInfo = null;

    // If badge ID provided, get device ID from badge
    if (badgeId) {
      const badge = await verificationDB.queryRow<{
        device_id: number;
        badge_type: string;
        click_count: number;
        created_at: Date;
        is_active: boolean;
        expires_at?: Date;
      }>`
        SELECT device_id, badge_type, click_count, created_at, is_active, expires_at
        FROM verification_badges
        WHERE badge_id = ${badgeId}
      `;

      if (!badge) {
        throw new Error("Badge not found");
      }

      const isExpired = badge.expires_at && new Date() > badge.expires_at;
      if (!badge.is_active || isExpired) {
        throw new Error("Badge is inactive or expired");
      }

      targetDeviceId = badge.device_id;
      badgeInfo = {
        id: badgeId,
        type: badge.badge_type,
        clickCount: badge.click_count,
        createdAt: badge.created_at,
      };

      // Track access
      await verificationDB.exec`
        INSERT INTO lifecycle_access_logs (
          badge_id, device_id, access_type
        ) VALUES (
          ${badgeId}, ${targetDeviceId}, 'direct_link'
        )
      `;
    }

    if (!targetDeviceId) {
      throw new Error("Device ID or badge ID required");
    }

    // Get device information
    const device = await verificationDB.queryRow<{
      id: number;
      device_name: string;
      brand: string;
      model: string;
      serial_number: string;
      status: string;
      current_trust_score?: number;
      image_url?: string;
      lifecycle_summary: any;
    }>`
      SELECT id, device_name, brand, model, serial_number, status, 
             current_trust_score, image_url, lifecycle_summary
      FROM devices 
      WHERE id = ${targetDeviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Get current owner
    const currentOwner = await verificationDB.queryRow<{
      owner_alias: string;
      owner_type: string;
      verification_level: string;
      transfer_date: Date;
      location_country?: string;
    }>`
      SELECT owner_alias, owner_type, verification_level, transfer_date, location_country
      FROM ownership_history
      WHERE device_id = ${targetDeviceId} AND is_current_owner = true
    `;

    // Get lifecycle events
    const lifecycleEvents = await verificationDB.queryAll<{
      id: number;
      event_category: string;
      event_data: any;
      event_source: string;
      verification_level: string;
      created_at: Date;
    }>`
      SELECT id, event_category, event_data, event_source, verification_level, created_at
      FROM product_lifecycle
      WHERE device_id = ${targetDeviceId} 
        AND (is_public = true OR ${includePrivate})
      ORDER BY created_at DESC
    `;

    // Get ownership history
    const ownershipHistory = await verificationDB.queryAll<{
      owner_alias: string;
      owner_type: string;
      verification_level: string;
      transfer_date: Date;
      location_country?: string;
      is_current_owner: boolean;
    }>`
      SELECT owner_alias, owner_type, verification_level, transfer_date, 
             location_country, is_current_owner
      FROM ownership_history
      WHERE device_id = ${targetDeviceId}
      ORDER BY transfer_date DESC
    `;

    // Get repair records
    const repairRecords = await verificationDB.queryAll<{
      repair_shop: string;
      repair_type: string;
      repair_description?: string;
      repair_cost?: number;
      repair_date: Date;
      warranty_period_days: number;
      is_authorized_repair: boolean;
    }>`
      SELECT repair_shop, repair_type, repair_description, repair_cost,
             repair_date, warranty_period_days, is_authorized_repair
      FROM repair_records
      WHERE device_id = ${targetDeviceId}
      ORDER BY repair_date DESC
    `;

    // Get warranty information
    const warranties = await verificationDB.queryAll<{
      warranty_provider: string;
      warranty_type: string;
      start_date: Date;
      end_date: Date;
      is_active: boolean;
      claim_count: number;
    }>`
      SELECT warranty_provider, warranty_type, start_date, end_date, 
             is_active, claim_count
      FROM product_warranties
      WHERE device_id = ${targetDeviceId}
      ORDER BY start_date DESC
    `;

    // Get insurance records
    const insuranceRecords = await verificationDB.queryAll<{
      insurance_provider: string;
      policy_number?: string;
      coverage_amount?: number;
      start_date: Date;
      end_date?: Date;
      is_active: boolean;
      claim_history: any;
    }>`
      SELECT insurance_provider, policy_number, coverage_amount,
             start_date, end_date, is_active, claim_history
      FROM insurance_records
      WHERE device_id = ${targetDeviceId}
      ORDER BY start_date DESC
    `;

    // Build ownership timeline
    const ownership = ownershipHistory.map((owner, index) => {
      const nextOwner = ownershipHistory[index + 1];
      return {
        owner: owner.owner_alias,
        type: owner.owner_type,
        from: owner.transfer_date,
        to: nextOwner ? nextOwner.transfer_date : undefined,
        verificationLevel: owner.verification_level,
        location: owner.location_country,
      };
    });

    // Calculate lifecycle summary
    const summary: LifecycleSummary = {
      totalEvents: lifecycleEvents.length,
      ownershipChanges: ownershipHistory.length,
      repairCount: repairRecords.length,
      insuranceClaims: insuranceRecords.reduce((sum, ins) => sum + (ins.claim_history?.length || 0), 0),
      warrantyStatus: warranties.find(w => w.is_active) ? 'active' : 'expired',
      policeReports: lifecycleEvents.filter(e => e.event_category === 'police').length,
      lastUpdate: new Date(),
    };

    const accessId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      device: {
        id: device.id,
        name: device.device_name,
        brand: device.brand,
        model: device.model,
        serialNumber: device.serial_number,
        status: device.status,
        trustScore: device.current_trust_score,
        imageUrl: device.image_url,
      },
      currentOwner: currentOwner ? {
        alias: currentOwner.owner_alias,
        type: currentOwner.owner_type,
        verificationLevel: currentOwner.verification_level,
        since: currentOwner.transfer_date,
        location: currentOwner.location_country,
      } : undefined,
      lifecycle: {
        summary,
        events: lifecycleEvents.map(event => ({
          id: event.id,
          category: event.event_category,
          data: event.event_data,
          source: event.event_source,
          verificationLevel: event.verification_level,
          timestamp: event.created_at,
        })),
        ownership,
        repairs: repairRecords.map(repair => ({
          shop: repair.repair_shop,
          type: repair.repair_type,
          description: repair.repair_description || '',
          cost: repair.repair_cost,
          date: repair.repair_date,
          warranty: repair.warranty_period_days,
          authorized: repair.is_authorized_repair,
        })),
        warranties: warranties.map(warranty => ({
          provider: warranty.warranty_provider,
          type: warranty.warranty_type,
          startDate: warranty.start_date,
          endDate: warranty.end_date,
          isActive: warranty.is_active,
          claimCount: warranty.claim_count,
        })),
        insurance: insuranceRecords.map(insurance => ({
          provider: insurance.insurance_provider,
          policyNumber: insurance.policy_number,
          coverage: insurance.coverage_amount,
          startDate: insurance.start_date,
          endDate: insurance.end_date,
          isActive: insurance.is_active,
          claims: insurance.claim_history || [],
        })),
      },
      badge: badgeInfo || undefined,
      accessMetadata: {
        accessId,
        timestamp: new Date(),
        isPublicAccess: !includePrivate,
      },
    };
  }
);

async function updateLifecycleSummary(deviceId: number): Promise<void> {
  // Get counts for summary
  const counts = await verificationDB.queryRow<{
    lifecycle_events: number;
    ownership_changes: number;
    repair_count: number;
    warranty_count: number;
    insurance_count: number;
  }>`
    SELECT 
      (SELECT COUNT(*) FROM product_lifecycle WHERE device_id = ${deviceId}) as lifecycle_events,
      (SELECT COUNT(*) FROM ownership_history WHERE device_id = ${deviceId}) as ownership_changes,
      (SELECT COUNT(*) FROM repair_records WHERE device_id = ${deviceId}) as repair_count,
      (SELECT COUNT(*) FROM product_warranties WHERE device_id = ${deviceId}) as warranty_count,
      (SELECT COUNT(*) FROM insurance_records WHERE device_id = ${deviceId}) as insurance_count
  `;

  const summary = {
    totalEvents: counts?.lifecycle_events || 0,
    ownershipChanges: counts?.ownership_changes || 0,
    repairCount: counts?.repair_count || 0,
    warrantyCount: counts?.warranty_count || 0,
    insuranceCount: counts?.insurance_count || 0,
    lastUpdated: new Date().toISOString(),
  };

  await verificationDB.exec`
    UPDATE devices 
    SET lifecycle_summary = ${JSON.stringify(summary)},
        last_lifecycle_update = CURRENT_TIMESTAMP
    WHERE id = ${deviceId}
  `;
}
