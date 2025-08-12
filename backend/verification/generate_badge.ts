import { api } from "encore.dev/api";
import { verificationDB } from "./db";
import { createHash } from "crypto";

export interface GenerateBadgeRequest {
  deviceId: number;
  partnerId?: number;
  badgeType?: "standard" | "premium" | "marketplace";
  expiryDays?: number;
  customization?: {
    color?: string;
    size?: "small" | "medium" | "large";
    style?: "minimal" | "detailed" | "branded";
  };
}

export interface GenerateBadgeResponse {
  badgeId: string;
  badgeUrl: string;
  embedCode: string;
  verificationUrl: string;
  expiresAt?: Date;
  badgeConfig: {
    type: string;
    style: any;
    deviceInfo: {
      name: string;
      brand: string;
      model: string;
      status: string;
    };
  };
}

// Generates a verification badge for a device that can be embedded on partner sites.
export const generateBadge = api<GenerateBadgeRequest, GenerateBadgeResponse>(
  { expose: true, method: "POST", path: "/badge/generate" },
  async (req) => {
    const { deviceId, partnerId, badgeType = "standard", expiryDays, customization } = req;

    // Verify device exists
    const device = await verificationDB.queryRow<{
      id: number;
      device_name: string;
      brand: string;
      model: string;
      status: string;
      serial_number: string;
    }>`
      SELECT id, device_name, brand, model, status, serial_number
      FROM devices 
      WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Generate unique badge ID
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);
    const badgeId = `badge_${timestamp}_${randomString}`;

    // Calculate expiry if specified
    let expiresAt: Date | undefined;
    if (expiryDays) {
      expiresAt = new Date(Date.now() + (expiryDays * 24 * 60 * 60 * 1000));
    }

    // Store badge in database
    await verificationDB.exec`
      INSERT INTO verification_badges (
        device_id, badge_id, partner_id, badge_type, expires_at
      ) VALUES (
        ${deviceId}, ${badgeId}, ${partnerId || null}, ${badgeType}, ${expiresAt || null}
      )
    `;

    // Update device badge count
    await verificationDB.exec`
      UPDATE devices 
      SET verification_badge_count = verification_badge_count + 1
      WHERE id = ${deviceId}
    `;

    // Generate URLs
    const baseUrl = "https://stolen-verify.app"; // In production, use environment variable
    const verificationUrl = `${baseUrl}/lifecycle/${badgeId}`;
    const badgeUrl = `${baseUrl}/api/badge/${badgeId}/image`;

    // Generate embed code
    const embedCode = generateEmbedCode(badgeId, badgeUrl, verificationUrl, customization);

    // Log badge generation
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${deviceId}, 'badge_generated', 
              ${`Verification badge ${badgeId} generated for ${badgeType} use`}, true)
    `;

    const badgeConfig = {
      type: badgeType,
      style: customization || { color: "blue", size: "medium", style: "detailed" },
      deviceInfo: {
        name: device.device_name,
        brand: device.brand,
        model: device.model,
        status: device.status,
      },
    };

    return {
      badgeId,
      badgeUrl,
      embedCode,
      verificationUrl,
      expiresAt,
      badgeConfig,
    };
  }
);

export interface GetBadgeRequest {
  badgeId: string;
}

export interface GetBadgeResponse {
  badge: {
    id: string;
    deviceId: number;
    badgeType: string;
    isActive: boolean;
    clickCount: number;
    createdAt: Date;
    expiresAt?: Date;
  };
  device: {
    name: string;
    brand: string;
    model: string;
    status: string;
    trustScore?: number;
  };
  isValid: boolean;
}

// Gets badge information and validates its status.
export const getBadge = api<GetBadgeRequest, GetBadgeResponse>(
  { expose: true, method: "GET", path: "/badge/:badgeId" },
  async (req) => {
    const { badgeId } = req;

    const badgeData = await verificationDB.queryRow<{
      id: number;
      device_id: number;
      badge_type: string;
      is_active: boolean;
      click_count: number;
      created_at: Date;
      expires_at?: Date;
      device_name: string;
      brand: string;
      model: string;
      status: string;
      current_trust_score?: number;
    }>`
      SELECT vb.id, vb.device_id, vb.badge_type, vb.is_active, vb.click_count,
             vb.created_at, vb.expires_at, d.device_name, d.brand, d.model, 
             d.status, d.current_trust_score
      FROM verification_badges vb
      JOIN devices d ON vb.device_id = d.id
      WHERE vb.badge_id = ${badgeId}
    `;

    if (!badgeData) {
      throw new Error("Badge not found");
    }

    // Check if badge is expired
    const isExpired = badgeData.expires_at && new Date() > badgeData.expires_at;
    const isValid = badgeData.is_active && !isExpired;

    return {
      badge: {
        id: badgeId,
        deviceId: badgeData.device_id,
        badgeType: badgeData.badge_type,
        isActive: badgeData.is_active,
        clickCount: badgeData.click_count,
        createdAt: badgeData.created_at,
        expiresAt: badgeData.expires_at,
      },
      device: {
        name: badgeData.device_name,
        brand: badgeData.brand,
        model: badgeData.model,
        status: badgeData.status,
        trustScore: badgeData.current_trust_score,
      },
      isValid,
    };
  }
);

export interface TrackBadgeClickRequest {
  badgeId: string;
  accessType?: "badge_click" | "direct_link" | "api_request";
  ipAddress?: string;
  userAgent?: string;
  referrerUrl?: string;
}

export interface TrackBadgeClickResponse {
  success: boolean;
  verificationUrl: string;
  clickCount: number;
}

// Tracks badge clicks and returns verification URL.
export const trackBadgeClick = api<TrackBadgeClickRequest, TrackBadgeClickResponse>(
  { expose: true, method: "POST", path: "/badge/:badgeId/click" },
  async (req) => {
    const { badgeId, accessType = "badge_click", ipAddress, userAgent, referrerUrl } = req;

    // Verify badge exists and is active
    const badge = await verificationDB.queryRow<{
      device_id: number;
      is_active: boolean;
      expires_at?: Date;
      click_count: number;
    }>`
      SELECT device_id, is_active, expires_at, click_count
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

    // Update click count
    await verificationDB.exec`
      UPDATE verification_badges 
      SET click_count = click_count + 1, last_accessed = CURRENT_TIMESTAMP
      WHERE badge_id = ${badgeId}
    `;

    // Log access
    await verificationDB.exec`
      INSERT INTO lifecycle_access_logs (
        badge_id, device_id, access_type, ip_address, user_agent, referrer_url
      ) VALUES (
        ${badgeId}, ${badge.device_id}, ${accessType}, ${ipAddress || null}, 
        ${userAgent || null}, ${referrerUrl || null}
      )
    `;

    const verificationUrl = `https://stolen-verify.app/lifecycle/${badgeId}`;

    return {
      success: true,
      verificationUrl,
      clickCount: badge.click_count + 1,
    };
  }
);

export interface GetBadgeImageRequest {
  badgeId: string;
  format?: "svg" | "png";
  size?: "small" | "medium" | "large";
}

export interface GetBadgeImageResponse {
  imageData: string;
  contentType: string;
  cacheHeaders: Record<string, string>;
}

// Generates badge image for embedding.
export const getBadgeImage = api<GetBadgeImageRequest, GetBadgeImageResponse>(
  { expose: true, method: "GET", path: "/badge/:badgeId/image" },
  async (req) => {
    const { badgeId, format = "svg", size = "medium" } = req;

    // Get badge and device info
    const badgeInfo = await getBadge({ badgeId });
    
    if (!badgeInfo.isValid) {
      throw new Error("Badge is invalid or expired");
    }

    // Generate SVG badge
    const svgBadge = generateSVGBadge(badgeInfo, size);
    
    const cacheHeaders = {
      "Cache-Control": "public, max-age=3600",
      "ETag": createHash('md5').update(svgBadge).digest('hex'),
    };

    if (format === "svg") {
      return {
        imageData: svgBadge,
        contentType: "image/svg+xml",
        cacheHeaders,
      };
    }

    // For PNG, would need image conversion library
    // For now, return SVG
    return {
      imageData: svgBadge,
      contentType: "image/svg+xml",
      cacheHeaders,
    };
  }
);

function generateEmbedCode(
  badgeId: string, 
  badgeUrl: string, 
  verificationUrl: string, 
  customization?: any
): string {
  const size = customization?.size || "medium";
  const style = customization?.style || "detailed";
  
  return `<!-- STOLEN Verification Badge -->
<div class="stolen-verification-badge" data-badge-id="${badgeId}">
  <a href="${verificationUrl}" target="_blank" rel="noopener">
    <img src="${badgeUrl}?size=${size}&style=${style}" 
         alt="STOLEN Verified Device" 
         style="border: none; display: inline-block;" />
  </a>
</div>
<script>
(function() {
  const badge = document.querySelector('[data-badge-id="${badgeId}"]');
  if (badge) {
    badge.addEventListener('click', function() {
      fetch('${badgeUrl.replace('/image', '/click')}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessType: 'badge_click',
          referrerUrl: window.location.href,
          userAgent: navigator.userAgent
        })
      });
    });
  }
})();
</script>`;
}

function generateSVGBadge(badgeInfo: GetBadgeResponse, size: string): string {
  const dimensions = {
    small: { width: 120, height: 40, fontSize: 10 },
    medium: { width: 160, height: 50, fontSize: 12 },
    large: { width: 200, height: 60, fontSize: 14 },
  };

  const dim = dimensions[size as keyof typeof dimensions] || dimensions.medium;
  const statusColor = badgeInfo.device.status === 'clean' ? '#10B981' : 
                     badgeInfo.device.status === 'flagged' ? '#EF4444' : '#F59E0B';

  return `<svg width="${dim.width}" height="${dim.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#1E40AF;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#3B82F6;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${dim.width}" height="${dim.height}" rx="8" fill="url(#bg)"/>
    <circle cx="${dim.height - 15}" cy="${dim.height / 2}" r="6" fill="${statusColor}"/>
    <text x="10" y="${dim.height / 2 - 5}" font-family="Arial, sans-serif" font-size="${dim.fontSize}" font-weight="bold" fill="white">
      STOLEN
    </text>
    <text x="10" y="${dim.height / 2 + 8}" font-family="Arial, sans-serif" font-size="${dim.fontSize - 2}" fill="white" opacity="0.9">
      VERIFIED
    </text>
    <text x="${dim.width - 25}" y="${dim.height / 2 + 3}" font-family="Arial, sans-serif" font-size="${dim.fontSize - 4}" fill="white" text-anchor="middle">
      ${badgeInfo.device.status.toUpperCase()}
    </text>
  </svg>`;
}
