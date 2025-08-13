import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";

export interface CreateBadgeRequest {
  entityId: number;
  verifiedBy: string;
  verificationMethod: "manual" | "automated" | "third_party";
  expiryDate?: Date;
  notes?: string;
}

export interface CreateBadgeResponse {
  success: boolean;
  badge: {
    entityId: number;
    status: "verified";
    verifiedBy: string;
    verificationMethod: string;
    issuedAt: Date;
    expiryDate?: Date;
  };
}

// Creates or updates a verified badge for an entity.
export const createBadge = api<CreateBadgeRequest, CreateBadgeResponse>(
  { expose: true, method: "POST", path: "/verification/badge" },
  async (req) => {
    const { entityId, verifiedBy, verificationMethod, expiryDate, notes } = req;

    // Check if entity (device) exists
    const entity = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM devices WHERE id = ${entityId}
    `;

    if (!entity) {
      throw APIError.notFound("Entity not found");
    }

    // Check if badge already exists
    const existingBadge = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM verification_badges WHERE entity_id = ${entityId}
    `;

    const issuedAt = new Date();

    if (existingBadge) {
      // Update existing badge
      await verificationDB.exec`
        UPDATE verification_badges 
        SET status = 'verified',
            verified_by = ${verifiedBy},
            method = ${verificationMethod},
            issued_at = ${issuedAt},
            expiry_date = ${expiryDate || null},
            revoked_at = NULL,
            revocation_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE entity_id = ${entityId}
      `;
    } else {
      // Create new badge
      await verificationDB.exec`
        INSERT INTO verification_badges (
          entity_id, status, verified_by, method, issued_at, expiry_date
        ) VALUES (
          ${entityId}, 'verified', ${verifiedBy}, ${verificationMethod}, 
          ${issuedAt}, ${expiryDate || null}
        )
      `;
    }

    // Log the verification event in history
    await verificationDB.exec`
      INSERT INTO verification_history (
        entity_id, status, verified_by, method, notes, timestamp
      ) VALUES (
        ${entityId}, 'verified', ${verifiedBy}, ${verificationMethod}, 
        ${notes || null}, ${issuedAt}
      )
    `;

    // Log device event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${entityId}, 'badge_verified', 
              ${`Entity verified by ${verifiedBy} using ${verificationMethod} method`}, 
              ${verifiedBy}, true)
    `;

    return {
      success: true,
      badge: {
        entityId,
        status: "verified",
        verifiedBy,
        verificationMethod,
        issuedAt,
        expiryDate,
      },
    };
  }
);

export interface GetStatusRequest {
  entityId: number;
}

export interface GetStatusResponse {
  entityId: number;
  status: "pending" | "verified" | "revoked" | "expired";
  verifiedBy?: string;
  issuedAt?: Date;
  expiryDate?: Date;
  revokedAt?: Date;
  revocationReason?: string;
}

// Retrieves current verification status of an entity.
export const getStatus = api<GetStatusRequest, GetStatusResponse>(
  { expose: true, method: "GET", path: "/verification/:entityId/status" },
  async (req) => {
    const { entityId } = req;

    const badge = await verificationDB.queryRow<{
      entity_id: number;
      status: string;
      verified_by?: string;
      issued_at?: Date;
      expiry_date?: Date;
      revoked_at?: Date;
      revocation_reason?: string;
    }>`
      SELECT entity_id, status, verified_by, issued_at, expiry_date, 
             revoked_at, revocation_reason
      FROM verification_badges 
      WHERE entity_id = ${entityId}
    `;

    if (!badge) {
      return {
        entityId,
        status: "pending",
      };
    }

    // Check if badge is expired
    let status = badge.status as "pending" | "verified" | "revoked" | "expired";
    if (badge.status === "verified" && badge.expiry_date && new Date() > badge.expiry_date) {
      status = "expired";
      
      // Update status in database
      await verificationDB.exec`
        UPDATE verification_badges 
        SET status = 'expired'
        WHERE entity_id = ${entityId}
      `;
    }

    return {
      entityId: badge.entity_id,
      status,
      verifiedBy: badge.verified_by,
      issuedAt: badge.issued_at,
      expiryDate: badge.expiry_date,
      revokedAt: badge.revoked_at,
      revocationReason: badge.revocation_reason,
    };
  }
);

export interface GetHistoryRequest {
  entityId: number;
}

export interface HistoryEvent {
  status: "pending" | "verified" | "revoked" | "expired";
  verifiedBy?: string;
  method?: string;
  notes?: string;
  reason?: string;
  timestamp: Date;
}

export interface GetHistoryResponse {
  entityId: number;
  history: HistoryEvent[];
}

// Retrieves lifecycle view/history of verification events.
export const getHistory = api<GetHistoryRequest, GetHistoryResponse>(
  { expose: true, method: "GET", path: "/verification/:entityId/history" },
  async (req) => {
    const { entityId } = req;

    const history = await verificationDB.queryAll<{
      status: string;
      verified_by?: string;
      method?: string;
      notes?: string;
      reason?: string;
      timestamp: Date;
    }>`
      SELECT status, verified_by, method, notes, reason, timestamp
      FROM verification_history 
      WHERE entity_id = ${entityId}
      ORDER BY timestamp DESC
    `;

    return {
      entityId,
      history: history.map(event => ({
        status: event.status as "pending" | "verified" | "revoked" | "expired",
        verifiedBy: event.verified_by,
        method: event.method,
        notes: event.notes,
        reason: event.reason,
        timestamp: event.timestamp,
      })),
    };
  }
);

export interface RevokeBadgeRequest {
  entityId: number;
  revokedBy: string;
  reason: string;
}

export interface RevokeBadgeResponse {
  success: boolean;
  message: string;
}

// Revokes verification badge for an entity.
export const revokeBadge = api<RevokeBadgeRequest, RevokeBadgeResponse>(
  { expose: true, method: "DELETE", path: "/verification/:entityId/badge" },
  async (req) => {
    const { entityId, revokedBy, reason } = req;

    // Check if badge exists and is currently verified
    const badge = await verificationDB.queryRow<{
      id: number;
      status: string;
    }>`
      SELECT id, status FROM verification_badges WHERE entity_id = ${entityId}
    `;

    if (!badge) {
      throw APIError.notFound("Verification badge not found");
    }

    if (badge.status !== "verified") {
      throw APIError.invalidArgument("Badge is not currently verified");
    }

    const revokedAt = new Date();

    // Update badge status
    await verificationDB.exec`
      UPDATE verification_badges 
      SET status = 'revoked',
          revoked_at = ${revokedAt},
          revocation_reason = ${reason},
          updated_at = CURRENT_TIMESTAMP
      WHERE entity_id = ${entityId}
    `;

    // Log the revocation event in history
    await verificationDB.exec`
      INSERT INTO verification_history (
        entity_id, status, verified_by, reason, timestamp
      ) VALUES (
        ${entityId}, 'revoked', ${revokedBy}, ${reason}, ${revokedAt}
      )
    `;

    // Log device event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${entityId}, 'badge_revoked', 
              ${`Verification badge revoked by ${revokedBy}: ${reason}`}, 
              ${revokedBy}, true)
    `;

    return {
      success: true,
      message: "Verification badge revoked successfully",
    };
  }
);

export interface GetBadgeStatsRequest {
  limit?: number;
}

export interface BadgeStats {
  totalBadges: number;
  verifiedCount: number;
  revokedCount: number;
  expiredCount: number;
  pendingCount: number;
  recentVerifications: Array<{
    entityId: number;
    entityName: string;
    verifiedBy: string;
    issuedAt: Date;
  }>;
}

export interface GetBadgeStatsResponse {
  stats: BadgeStats;
}

// Gets verification badge statistics for admin dashboard.
export const getBadgeStats = api<GetBadgeStatsRequest, GetBadgeStatsResponse>(
  { expose: true, method: "GET", path: "/verification/stats" },
  async (req) => {
    const { limit = 10 } = req;

    // Get badge counts by status
    const counts = await verificationDB.queryRow<{
      total_badges: number;
      verified_count: number;
      revoked_count: number;
      expired_count: number;
    }>`
      SELECT 
        COUNT(*) as total_badges,
        COUNT(CASE WHEN status = 'verified' AND (expiry_date IS NULL OR expiry_date > CURRENT_TIMESTAMP) THEN 1 END) as verified_count,
        COUNT(CASE WHEN status = 'revoked' THEN 1 END) as revoked_count,
        COUNT(CASE WHEN status = 'verified' AND expiry_date IS NOT NULL AND expiry_date <= CURRENT_TIMESTAMP THEN 1 END) as expired_count
      FROM verification_badges
    `;

    // Get recent verifications
    const recentVerifications = await verificationDB.queryAll<{
      entity_id: number;
      device_name: string;
      verified_by: string;
      issued_at: Date;
    }>`
      SELECT vb.entity_id, d.device_name, vb.verified_by, vb.issued_at
      FROM verification_badges vb
      JOIN devices d ON vb.entity_id = d.id
      WHERE vb.status = 'verified'
      ORDER BY vb.issued_at DESC
      LIMIT ${limit}
    `;

    const pendingCount = 0; // Calculated as entities without badges

    return {
      stats: {
        totalBadges: counts?.total_badges || 0,
        verifiedCount: counts?.verified_count || 0,
        revokedCount: counts?.revoked_count || 0,
        expiredCount: counts?.expired_count || 0,
        pendingCount,
        recentVerifications: recentVerifications.map(rv => ({
          entityId: rv.entity_id,
          entityName: rv.device_name,
          verifiedBy: rv.verified_by,
          issuedAt: rv.issued_at,
        })),
      },
    };
  }
);

export interface BatchUpdateBadgesRequest {
  updates: Array<{
    entityId: number;
    action: "verify" | "revoke" | "extend";
    verifiedBy: string;
    reason?: string;
    expiryDate?: Date;
  }>;
}

export interface BatchUpdateBadgesResponse {
  success: boolean;
  processed: number;
  results: Array<{
    entityId: number;
    success: boolean;
    error?: string;
  }>;
}

// Batch update verification badges for multiple entities.
export const batchUpdateBadges = api<BatchUpdateBadgesRequest, BatchUpdateBadgesResponse>(
  { expose: true, method: "POST", path: "/verification/batch-update" },
  async (req) => {
    const { updates } = req;
    const results: Array<{ entityId: number; success: boolean; error?: string }> = [];

    for (const update of updates) {
      try {
        const { entityId, action, verifiedBy, reason, expiryDate } = update;

        switch (action) {
          case "verify":
            await verificationDB.exec`
              INSERT INTO verification_badges (entity_id, status, verified_by, method, issued_at, expiry_date)
              VALUES (${entityId}, 'verified', ${verifiedBy}, 'manual', CURRENT_TIMESTAMP, ${expiryDate || null})
              ON CONFLICT (entity_id) DO UPDATE SET
                status = 'verified',
                verified_by = ${verifiedBy},
                issued_at = CURRENT_TIMESTAMP,
                expiry_date = ${expiryDate || null},
                revoked_at = NULL,
                revocation_reason = NULL
            `;
            break;

          case "revoke":
            await verificationDB.exec`
              UPDATE verification_badges 
              SET status = 'revoked',
                  revoked_at = CURRENT_TIMESTAMP,
                  revocation_reason = ${reason || 'Batch revocation'}
              WHERE entity_id = ${entityId}
            `;
            break;

          case "extend":
            await verificationDB.exec`
              UPDATE verification_badges 
              SET expiry_date = ${expiryDate || null}
              WHERE entity_id = ${entityId}
            `;
            break;
        }

        // Log history event
        await verificationDB.exec`
          INSERT INTO verification_history (entity_id, status, verified_by, reason, timestamp)
          VALUES (${entityId}, ${action === 'verify' ? 'verified' : action === 'revoke' ? 'revoked' : 'extended'}, 
                  ${verifiedBy}, ${reason || `Batch ${action}`}, CURRENT_TIMESTAMP)
        `;

        results.push({ entityId, success: true });
      } catch (error) {
        results.push({ 
          entityId: update.entityId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return {
      success: true,
      processed: updates.length,
      results,
    };
  }
);
