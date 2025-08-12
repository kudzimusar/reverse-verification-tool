import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface PartnerBadgeRequest {
  partnerId: number;
  deviceIdentifier: string;
  identifierType: "serial" | "imei";
  badgeType?: "standard" | "premium" | "marketplace";
  customization?: {
    color?: string;
    size?: "small" | "medium" | "large";
    style?: "minimal" | "detailed" | "branded";
  };
  expiryDays?: number;
}

export interface PartnerBadgeResponse {
  success: boolean;
  badge: {
    badgeId: string;
    embedCode: string;
    verificationUrl: string;
    badgeUrl: string;
    expiresAt?: Date;
  };
  device: {
    id: number;
    name: string;
    status: string;
    trustScore?: number;
  };
}

// Allows partners to generate verification badges for devices.
export const createPartnerBadge = api<PartnerBadgeRequest, PartnerBadgeResponse>(
  { expose: true, method: "POST", path: "/partner/badge/create" },
  async (req) => {
    const { 
      partnerId, 
      deviceIdentifier, 
      identifierType, 
      badgeType = "marketplace",
      customization,
      expiryDays = 365 
    } = req;

    // Verify partner exists and is active
    const partner = await verificationDB.queryRow<{
      id: number;
      name: string;
      is_active: boolean;
    }>`
      SELECT id, name, is_active
      FROM partners
      WHERE id = ${partnerId} AND is_active = true
    `;

    if (!partner) {
      throw new Error("Partner not found or inactive");
    }

    // Find device by identifier
    const device = await verificationDB.queryRow<{
      id: number;
      device_name: string;
      status: string;
      current_trust_score?: number;
    }>`
      SELECT id, device_name, status, current_trust_score
      FROM devices 
      WHERE ${identifierType === 'serial' ? 'serial_number' : 'imei'} = ${deviceIdentifier}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Generate badge using existing endpoint
    const badgeResponse = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM verification_badges WHERE device_id = ${device.id} AND partner_id = ${partnerId} AND is_active = true
    `;

    let badgeId: string;
    let embedCode: string;
    let verificationUrl: string;
    let badgeUrl: string;
    let expiresAt: Date | undefined;

    if (badgeResponse) {
      // Reuse existing badge
      const existingBadge = await verificationDB.queryRow<{
        badge_id: string;
        expires_at?: Date;
      }>`
        SELECT badge_id, expires_at
        FROM verification_badges
        WHERE id = ${badgeResponse.id}
      `;

      badgeId = existingBadge!.badge_id;
      expiresAt = existingBadge!.expires_at;
    } else {
      // Create new badge
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substr(2, 9);
      badgeId = `partner_${partnerId}_${timestamp}_${randomString}`;
      
      if (expiryDays) {
        expiresAt = new Date(Date.now() + (expiryDays * 24 * 60 * 60 * 1000));
      }

      await verificationDB.exec`
        INSERT INTO verification_badges (
          device_id, badge_id, partner_id, badge_type, expires_at
        ) VALUES (
          ${device.id}, ${badgeId}, ${partnerId}, ${badgeType}, ${expiresAt || null}
        )
      `;
    }

    // Generate URLs and embed code
    const baseUrl = "https://stolen-verify.app";
    verificationUrl = `${baseUrl}/lifecycle/${badgeId}`;
    badgeUrl = `${baseUrl}/api/badge/${badgeId}/image`;
    
    embedCode = generatePartnerEmbedCode(badgeId, badgeUrl, verificationUrl, customization, partner.name);

    // Log partner badge creation
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${device.id}, 'partner_badge_created', 
              ${`Partner badge created by ${partner.name}`}, ${partner.name}, true)
    `;

    return {
      success: true,
      badge: {
        badgeId,
        embedCode,
        verificationUrl,
        badgeUrl,
        expiresAt,
      },
      device: {
        id: device.id,
        name: device.device_name,
        status: device.status,
        trustScore: device.current_trust_score,
      },
    };
  }
);

export interface PartnerVerificationRequest {
  partnerId: number;
  deviceIdentifier: string;
  identifierType: "serial" | "imei";
  includeLifecycle?: boolean;
}

export interface PartnerVerificationResponse {
  device: {
    id: number;
    name: string;
    brand: string;
    model: string;
    status: string;
    trustScore?: number;
    riskCategory?: string;
  };
  verification: {
    isVerified: boolean;
    confidence: number;
    lastVerified: Date;
    reportCount: number;
  };
  lifecycle?: {
    ownershipChanges: number;
    repairCount: number;
    warrantyStatus: string;
    insuranceStatus: string;
    policeReports: number;
  };
  badge?: {
    available: boolean;
    badgeId?: string;
    verificationUrl?: string;
  };
}

// Provides verification data for partners without generating badges.
export const partnerVerification = api<PartnerVerificationRequest, PartnerVerificationResponse>(
  { expose: true, method: "POST", path: "/partner/verify" },
  async (req) => {
    const { partnerId, deviceIdentifier, identifierType, includeLifecycle = false } = req;

    // Verify partner
    const partner = await verificationDB.queryRow<{
      id: number;
      is_active: boolean;
    }>`
      SELECT id, is_active
      FROM partners
      WHERE id = ${partnerId} AND is_active = true
    `;

    if (!partner) {
      throw new Error("Partner not found or inactive");
    }

    // Find and verify device
    const device = await verificationDB.queryRow<{
      id: number;
      device_name: string;
      brand: string;
      model: string;
      status: string;
      current_trust_score?: number;
      risk_category?: string;
      updated_at: Date;
      lifecycle_summary: any;
    }>`
      SELECT id, device_name, brand, model, status, current_trust_score, 
             risk_category, updated_at, lifecycle_summary
      FROM devices 
      WHERE ${identifierType === 'serial' ? 'serial_number' : 'imei'} = ${deviceIdentifier}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Get report count
    const reportResult = await verificationDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM reports 
      WHERE device_id = ${device.id}
    `;

    // Check for existing badge
    const existingBadge = await verificationDB.queryRow<{
      badge_id: string;
      is_active: boolean;
    }>`
      SELECT badge_id, is_active
      FROM verification_badges
      WHERE device_id = ${device.id} AND partner_id = ${partnerId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Log partner verification
    await verificationDB.exec`
      INSERT INTO verification_logs (
        partner_id, device_id, verification_type, identifier_used, 
        identifier_type, result_status
      ) VALUES (
        ${partnerId}, ${device.id}, 'partner_api', ${deviceIdentifier}, 
        ${identifierType}, 'found'
      )
    `;

    const response: PartnerVerificationResponse = {
      device: {
        id: device.id,
        name: device.device_name,
        brand: device.brand,
        model: device.model,
        status: device.status,
        trustScore: device.current_trust_score,
        riskCategory: device.risk_category,
      },
      verification: {
        isVerified: device.status !== 'flagged',
        confidence: device.current_trust_score || 50,
        lastVerified: device.updated_at,
        reportCount: reportResult?.count || 0,
      },
      badge: {
        available: true,
        badgeId: existingBadge?.badge_id,
        verificationUrl: existingBadge ? `https://stolen-verify.app/lifecycle/${existingBadge.badge_id}` : undefined,
      },
    };

    if (includeLifecycle && device.lifecycle_summary) {
      const summary = device.lifecycle_summary;
      response.lifecycle = {
        ownershipChanges: summary.ownershipChanges || 0,
        repairCount: summary.repairCount || 0,
        warrantyStatus: summary.warrantyCount > 0 ? 'active' : 'none',
        insuranceStatus: summary.insuranceCount > 0 ? 'active' : 'none',
        policeReports: summary.policeReports || 0,
      };
    }

    return response;
  }
);

export interface GetPartnerBadgesRequest {
  partnerId: number;
  limit?: number;
  status?: "active" | "expired" | "all";
}

export interface PartnerBadgeInfo {
  badgeId: string;
  deviceId: number;
  deviceName: string;
  badgeType: string;
  clickCount: number;
  isActive: boolean;
  createdAt: Date;
  expiresAt?: Date;
  verificationUrl: string;
}

export interface GetPartnerBadgesResponse {
  badges: PartnerBadgeInfo[];
  total: number;
  summary: {
    active: number;
    expired: number;
    totalClicks: number;
  };
}

// Gets all badges created by a partner.
export const getPartnerBadges = api<GetPartnerBadgesRequest, GetPartnerBadgesResponse>(
  { expose: true, method: "GET", path: "/partner/:partnerId/badges" },
  async (req) => {
    const { partnerId, limit = 50, status = "all" } = req;

    let whereConditions = [`vb.partner_id = ${partnerId}`];
    
    if (status === "active") {
      whereConditions.push("vb.is_active = true");
      whereConditions.push("(vb.expires_at IS NULL OR vb.expires_at > CURRENT_TIMESTAMP)");
    } else if (status === "expired") {
      whereConditions.push("(vb.is_active = false OR vb.expires_at <= CURRENT_TIMESTAMP)");
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const badges = await verificationDB.queryAll<{
      badge_id: string;
      device_id: number;
      device_name: string;
      badge_type: string;
      click_count: number;
      is_active: boolean;
      created_at: Date;
      expires_at?: Date;
    }>`
      SELECT vb.badge_id, vb.device_id, d.device_name, vb.badge_type,
             vb.click_count, vb.is_active, vb.created_at, vb.expires_at
      FROM verification_badges vb
      JOIN devices d ON vb.device_id = d.id
      ${whereClause}
      ORDER BY vb.created_at DESC
      LIMIT ${limit}
    `;

    // Get summary statistics
    const summary = await verificationDB.queryRow<{
      total_badges: number;
      active_badges: number;
      total_clicks: number;
    }>`
      SELECT 
        COUNT(*) as total_badges,
        COUNT(CASE WHEN is_active = true AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) THEN 1 END) as active_badges,
        SUM(click_count) as total_clicks
      FROM verification_badges
      WHERE partner_id = ${partnerId}
    `;

    const badgeInfos: PartnerBadgeInfo[] = badges.map(badge => ({
      badgeId: badge.badge_id,
      deviceId: badge.device_id,
      deviceName: badge.device_name,
      badgeType: badge.badge_type,
      clickCount: badge.click_count,
      isActive: badge.is_active,
      createdAt: badge.created_at,
      expiresAt: badge.expires_at,
      verificationUrl: `https://stolen-verify.app/lifecycle/${badge.badge_id}`,
    }));

    return {
      badges: badgeInfos,
      total: summary?.total_badges || 0,
      summary: {
        active: summary?.active_badges || 0,
        expired: (summary?.total_badges || 0) - (summary?.active_badges || 0),
        totalClicks: summary?.total_clicks || 0,
      },
    };
  }
);

function generatePartnerEmbedCode(
  badgeId: string,
  badgeUrl: string,
  verificationUrl: string,
  customization?: any,
  partnerName?: string
): string {
  const size = customization?.size || "medium";
  const style = customization?.style || "detailed";
  
  return `<!-- STOLEN Verification Badge - ${partnerName} -->
<div class="stolen-verification-badge" data-badge-id="${badgeId}" data-partner="${partnerName}">
  <a href="${verificationUrl}" target="_blank" rel="noopener" title="View device verification and lifecycle">
    <img src="${badgeUrl}?size=${size}&style=${style}" 
         alt="STOLEN Verified Device - Click to view lifecycle" 
         style="border: none; display: inline-block; cursor: pointer;" />
  </a>
</div>
<script>
(function() {
  const badge = document.querySelector('[data-badge-id="${badgeId}"]');
  if (badge) {
    badge.addEventListener('click', function(e) {
      // Track click
      fetch('${badgeUrl.replace('/image', '/click')}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessType: 'badge_click',
          referrerUrl: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {}); // Silent fail for tracking
      
      // Allow default link behavior
    });
    
    // Add hover effect
    badge.style.transition = 'opacity 0.2s ease';
    badge.addEventListener('mouseenter', function() {
      this.style.opacity = '0.8';
    });
    badge.addEventListener('mouseleave', function() {
      this.style.opacity = '1';
    });
  }
})();
</script>`;
}
