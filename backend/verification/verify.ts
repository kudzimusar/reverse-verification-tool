import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";

export interface VerifyDeviceRequest {
  identifier: string;
  identifierType: "serial" | "imei";
  includeTrustScore?: boolean;
  includeFingerprint?: boolean;
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
  trustScore?: number;
  riskCategory?: "low" | "medium" | "high";
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

export interface TrustScoreInfo {
  score: number;
  riskCategory: "low" | "medium" | "high";
  components: {
    ownershipContinuity: number;
    historyCompleteness: number;
    repairHistory: number;
    disputePenalty: number;
  };
  lastCalculated: Date;
}

export interface FingerprintInfo {
  fingerprintHash: string;
  hasFingerprint: boolean;
  fingerprintAge?: number; // days since creation
}

export interface VerifyDeviceResponse {
  device: DeviceInfo;
  currentOwner?: OwnershipInfo;
  ownershipHistory: OwnershipInfo[];
  events: DeviceEvent[];
  reportCount: number;
  trustScore?: TrustScoreInfo;
  fingerprint?: FingerprintInfo;
  verificationMetadata: {
    verificationId: string;
    timestamp: Date;
    confidence: number;
    dataSourcesChecked: string[];
  };
}

// Verifies a device by serial number or IMEI with enhanced features.
export const verify = api<VerifyDeviceRequest, VerifyDeviceResponse>(
  { expose: true, method: "POST", path: "/verify" },
  async (req) => {
    const { identifier, identifierType, includeTrustScore = true, includeFingerprint = false } = req;
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      current_trust_score?: number;
      risk_category?: string;
    }>`
      SELECT id, serial_number, imei, device_name, model, brand, image_url, 
             status, updated_at, current_trust_score, risk_category
      FROM devices 
      WHERE ${verificationDB.rawQuery(whereClause, identifier)}
    `.then(result => result);

    if (!device) {
      throw APIError.notFound("Device not found");
    }

    const dataSourcesChecked = ["stolen_database"];

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

    // Get trust score if requested
    let trustScore: TrustScoreInfo | undefined;
    if (includeTrustScore) {
      const trustScoreData = await verificationDB.queryRow<{
        score: number;
        risk_category: string;
        ownership_continuity_score: number;
        history_completeness_score: number;
        repair_history_score: number;
        dispute_penalty: number;
        calculated_at: Date;
      }>`
        SELECT score, risk_category, ownership_continuity_score,
               history_completeness_score, repair_history_score, 
               dispute_penalty, calculated_at
        FROM trust_scores 
        WHERE device_id = ${device.id}
      `;

      if (trustScoreData) {
        trustScore = {
          score: trustScoreData.score,
          riskCategory: trustScoreData.risk_category as "low" | "medium" | "high",
          components: {
            ownershipContinuity: trustScoreData.ownership_continuity_score,
            historyCompleteness: trustScoreData.history_completeness_score,
            repairHistory: trustScoreData.repair_history_score,
            disputePenalty: trustScoreData.dispute_penalty,
          },
          lastCalculated: trustScoreData.calculated_at,
        };
        dataSourcesChecked.push("trust_scoring");
      }
    }

    // Get fingerprint info if requested
    let fingerprint: FingerprintInfo | undefined;
    if (includeFingerprint) {
      const fingerprintData = await verificationDB.queryRow<{
        fingerprint_hash: string;
        created_at: Date;
      }>`
        SELECT fingerprint_hash, created_at
        FROM device_fingerprints 
        WHERE device_id = ${device.id}
      `;

      if (fingerprintData) {
        const fingerprintAge = Math.floor(
          (Date.now() - fingerprintData.created_at.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        fingerprint = {
          fingerprintHash: fingerprintData.fingerprint_hash,
          hasFingerprint: true,
          fingerprintAge,
        };
        dataSourcesChecked.push("device_fingerprinting");
      } else {
        fingerprint = {
          fingerprintHash: "",
          hasFingerprint: false,
        };
      }
    }

    const currentOwner = ownershipHistory.find(owner => owner.is_current_owner);

    // Calculate verification confidence
    let confidence = 70; // Base confidence
    
    if (events.filter(e => e.verified).length > 2) confidence += 10;
    if (trustScore && trustScore.score > 70) confidence += 15;
    if (fingerprint?.hasFingerprint) confidence += 10;
    if (ownershipHistory.length > 0) confidence += 5;
    
    confidence = Math.min(100, confidence);

    // Log verification attempt
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${device.id}, 'verification_request', 
              ${`Device verified via ${identifierType} (ID: ${verificationId})`}, true)
    `;

    const deviceInfo: DeviceInfo = {
      id: device.id,
      serialNumber: device.serial_number,
      imei: device.imei,
      deviceName: device.device_name,
      model: device.model,
      brand: device.brand,
      imageUrl: device.image_url,
      status: device.status as "clean" | "flagged" | "under_investigation",
      lastVerified: device.updated_at,
    };

    if (includeTrustScore && device.current_trust_score !== null) {
      deviceInfo.trustScore = device.current_trust_score;
      deviceInfo.riskCategory = device.risk_category as "low" | "medium" | "high";
    }

    return {
      device: deviceInfo,
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
      trustScore,
      fingerprint,
      verificationMetadata: {
        verificationId,
        timestamp: new Date(),
        confidence,
        dataSourcesChecked,
      },
    };
  }
);
