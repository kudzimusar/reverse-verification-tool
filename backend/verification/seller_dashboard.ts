import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface CreateSellerProfileRequest {
  sellerAlias: string;
  sellerType: "individual" | "business" | "dealer";
  contactMethod: "email" | "phone" | "platform_message";
  verificationDocuments?: string[];
}

export interface CreateSellerProfileResponse {
  sellerId: number;
  sellerAlias: string;
  verificationLevel: string;
  message: string;
}

// Creates a seller profile for badge generation and device management.
export const createSellerProfile = api<CreateSellerProfileRequest, CreateSellerProfileResponse>(
  { expose: true, method: "POST", path: "/seller/profile/create" },
  async (req) => {
    const { sellerAlias, sellerType, contactMethod, verificationDocuments } = req;

    // Check if seller alias already exists
    const existingSeller = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM seller_profiles WHERE seller_alias = ${sellerAlias}
    `;

    if (existingSeller) {
      throw new Error("Seller alias already exists");
    }

    // Determine verification level based on documents
    let verificationLevel = "basic";
    if (verificationDocuments && verificationDocuments.length > 0) {
      verificationLevel = sellerType === "business" ? "premium" : "verified";
    }

    // Create seller profile
    const result = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO seller_profiles (
        seller_alias, seller_type, verification_level, contact_method
      ) VALUES (
        ${sellerAlias}, ${sellerType}, ${verificationLevel}, ${contactMethod}
      )
      RETURNING id
    `;

    return {
      sellerId: result!.id,
      sellerAlias,
      verificationLevel,
      message: "Seller profile created successfully",
    };
  }
);

export interface GenerateSellerBadgeRequest {
  sellerId: number;
  deviceIdentifier: string;
  identifierType: "serial" | "imei";
  listingTitle?: string;
  listingPrice?: number;
  listingDescription?: string;
  badgeCustomization?: {
    showPrice?: boolean;
    showTrustScore?: boolean;
    style?: "minimal" | "detailed" | "premium";
  };
}

export interface GenerateSellerBadgeResponse {
  success: boolean;
  badge: {
    badgeId: string;
    embedCode: string;
    verificationUrl: string;
    qrCode: string;
  };
  device: {
    id: number;
    name: string;
    status: string;
    trustScore?: number;
  };
  seller: {
    alias: string;
    verificationLevel: string;
    reputationScore: number;
  };
}

// Allows sellers to generate verification badges for their device listings.
export const generateSellerBadge = api<GenerateSellerBadgeRequest, GenerateSellerBadgeResponse>(
  { expose: true, method: "POST", path: "/seller/badge/generate" },
  async (req) => {
    const { 
      sellerId, 
      deviceIdentifier, 
      identifierType, 
      listingTitle,
      listingPrice,
      listingDescription,
      badgeCustomization 
    } = req;

    // Verify seller exists
    const seller = await verificationDB.queryRow<{
      id: number;
      seller_alias: string;
      verification_level: string;
      reputation_score: number;
      is_active: boolean;
    }>`
      SELECT id, seller_alias, verification_level, reputation_score, is_active
      FROM seller_profiles
      WHERE id = ${sellerId} AND is_active = true
    `;

    if (!seller) {
      throw new Error("Seller not found or inactive");
    }

    // Find device
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

    // Generate badge
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substr(2, 9);
    const badgeId = `seller_${sellerId}_${timestamp}_${randomString}`;

    // Store badge
    await verificationDB.exec`
      INSERT INTO verification_badges (
        device_id, badge_id, badge_type, is_active
      ) VALUES (
        ${device.id}, ${badgeId}, 'seller', true
      )
    `;

    // Add listing information to lifecycle
    if (listingTitle || listingPrice || listingDescription) {
      const listingData = {
        title: listingTitle,
        price: listingPrice,
        description: listingDescription,
        seller: seller.seller_alias,
        sellerVerification: seller.verification_level,
        listedAt: new Date().toISOString(),
      };

      await verificationDB.exec`
        INSERT INTO product_lifecycle (
          device_id, event_category, event_data, event_source, verification_level
        ) VALUES (
          ${device.id}, 'ownership', ${JSON.stringify(listingData)}, 
          ${seller.seller_alias}, 'verified'
        )
      `;
    }

    // Generate URLs
    const baseUrl = "https://stolen-verify.app";
    const verificationUrl = `${baseUrl}/lifecycle/${badgeId}`;
    const badgeUrl = `${baseUrl}/api/badge/${badgeId}/image`;
    
    // Generate embed code with seller customization
    const embedCode = generateSellerEmbedCode(
      badgeId, 
      badgeUrl, 
      verificationUrl, 
      badgeCustomization,
      seller.seller_alias,
      device,
      listingPrice
    );

    // Generate QR code data
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(generateQRCodeSVG(verificationUrl)).toString('base64')}`;

    // Update seller stats
    await verificationDB.exec`
      UPDATE seller_profiles 
      SET total_sales = total_sales + 1
      WHERE id = ${sellerId}
    `;

    // Log seller badge generation
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (${device.id}, 'seller_badge_generated', 
              ${`Seller badge generated by ${seller.seller_alias}`}, ${seller.seller_alias}, true)
    `;

    return {
      success: true,
      badge: {
        badgeId,
        embedCode,
        verificationUrl,
        qrCode,
      },
      device: {
        id: device.id,
        name: device.device_name,
        status: device.status,
        trustScore: device.current_trust_score,
      },
      seller: {
        alias: seller.seller_alias,
        verificationLevel: seller.verification_level,
        reputationScore: seller.reputation_score,
      },
    };
  }
);

export interface GetSellerDashboardRequest {
  sellerId: number;
}

export interface SellerDashboardResponse {
  seller: {
    id: number;
    alias: string;
    type: string;
    verificationLevel: string;
    reputationScore: number;
    totalSales: number;
  };
  badges: Array<{
    badgeId: string;
    deviceName: string;
    deviceStatus: string;
    clickCount: number;
    createdAt: Date;
    verificationUrl: string;
  }>;
  devices: Array<{
    id: number;
    name: string;
    status: string;
    trustScore?: number;
    hasBadge: boolean;
    lastActivity: Date;
  }>;
  analytics: {
    totalBadges: number;
    totalClicks: number;
    averageTrustScore: number;
    deviceStatusBreakdown: Record<string, number>;
  };
}

// Gets seller dashboard with badges, devices, and analytics.
export const getSellerDashboard = api<GetSellerDashboardRequest, SellerDashboardResponse>(
  { expose: true, method: "GET", path: "/seller/:sellerId/dashboard" },
  async (req) => {
    const { sellerId } = req;

    // Get seller info
    const seller = await verificationDB.queryRow<{
      id: number;
      seller_alias: string;
      seller_type: string;
      verification_level: string;
      reputation_score: number;
      total_sales: number;
    }>`
      SELECT id, seller_alias, seller_type, verification_level, reputation_score, total_sales
      FROM seller_profiles
      WHERE id = ${sellerId}
    `;

    if (!seller) {
      throw new Error("Seller not found");
    }

    // Get seller's badges
    const badges = await verificationDB.queryAll<{
      badge_id: string;
      device_name: string;
      status: string;
      click_count: number;
      created_at: Date;
    }>`
      SELECT vb.badge_id, d.device_name, d.status, vb.click_count, vb.created_at
      FROM verification_badges vb
      JOIN devices d ON vb.device_id = d.id
      JOIN product_lifecycle pl ON d.id = pl.device_id
      WHERE pl.event_source = ${seller.seller_alias} 
        AND pl.event_category = 'ownership'
        AND vb.badge_type = 'seller'
      ORDER BY vb.created_at DESC
    `;

    // Get seller's devices (from lifecycle events)
    const devices = await verificationDB.queryAll<{
      device_id: number;
      device_name: string;
      status: string;
      current_trust_score?: number;
      updated_at: Date;
      has_badge: boolean;
    }>`
      SELECT DISTINCT d.id as device_id, d.device_name, d.status, 
             d.current_trust_score, d.updated_at,
             EXISTS(SELECT 1 FROM verification_badges vb WHERE vb.device_id = d.id AND vb.badge_type = 'seller') as has_badge
      FROM devices d
      JOIN product_lifecycle pl ON d.id = pl.device_id
      WHERE pl.event_source = ${seller.seller_alias}
      ORDER BY d.updated_at DESC
    `;

    // Calculate analytics
    const totalBadges = badges.length;
    const totalClicks = badges.reduce((sum, badge) => sum + badge.click_count, 0);
    const averageTrustScore = devices.length > 0 
      ? devices.reduce((sum, device) => sum + (device.current_trust_score || 0), 0) / devices.length
      : 0;

    const deviceStatusBreakdown = devices.reduce((acc, device) => {
      acc[device.status] = (acc[device.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      seller: {
        id: seller.id,
        alias: seller.seller_alias,
        type: seller.seller_type,
        verificationLevel: seller.verification_level,
        reputationScore: seller.reputation_score,
        totalSales: seller.total_sales,
      },
      badges: badges.map(badge => ({
        badgeId: badge.badge_id,
        deviceName: badge.device_name,
        deviceStatus: badge.status,
        clickCount: badge.click_count,
        createdAt: badge.created_at,
        verificationUrl: `https://stolen-verify.app/lifecycle/${badge.badge_id}`,
      })),
      devices: devices.map(device => ({
        id: device.device_id,
        name: device.device_name,
        status: device.status,
        trustScore: device.current_trust_score,
        hasBadge: device.has_badge,
        lastActivity: device.updated_at,
      })),
      analytics: {
        totalBadges,
        totalClicks,
        averageTrustScore: Math.round(averageTrustScore),
        deviceStatusBreakdown,
      },
    };
  }
);

function generateSellerEmbedCode(
  badgeId: string,
  badgeUrl: string,
  verificationUrl: string,
  customization?: any,
  sellerAlias?: string,
  device?: any,
  listingPrice?: number
): string {
  const showPrice = customization?.showPrice && listingPrice;
  const showTrustScore = customization?.showTrustScore && device?.current_trust_score;
  const style = customization?.style || "detailed";
  
  let additionalInfo = "";
  if (showPrice) {
    additionalInfo += `<div class="stolen-badge-price">$${listingPrice}</div>`;
  }
  if (showTrustScore) {
    additionalInfo += `<div class="stolen-badge-trust">Trust: ${device.current_trust_score}%</div>`;
  }

  return `<!-- STOLEN Seller Verification Badge -->
<div class="stolen-seller-badge" data-badge-id="${badgeId}" data-seller="${sellerAlias}">
  <a href="${verificationUrl}" target="_blank" rel="noopener" title="View complete device history and verification">
    <img src="${badgeUrl}?style=${style}" 
         alt="STOLEN Verified by ${sellerAlias}" 
         style="border: none; display: inline-block;" />
  </a>
  ${additionalInfo}
  <div class="stolen-badge-seller">Verified by ${sellerAlias}</div>
</div>
<style>
.stolen-seller-badge {
  display: inline-block;
  text-align: center;
  font-family: Arial, sans-serif;
  margin: 5px;
}
.stolen-badge-price {
  font-weight: bold;
  color: #059669;
  font-size: 14px;
  margin-top: 2px;
}
.stolen-badge-trust {
  font-size: 12px;
  color: #6B7280;
}
.stolen-badge-seller {
  font-size: 10px;
  color: #9CA3AF;
  margin-top: 2px;
}
</style>
<script>
(function() {
  const badge = document.querySelector('[data-badge-id="${badgeId}"]');
  if (badge) {
    badge.addEventListener('click', function() {
      fetch('${badgeUrl.replace('/image', '/click')}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessType: 'seller_badge_click',
          referrerUrl: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(() => {});
    });
  }
})();
</script>`;
}

function generateQRCodeSVG(data: string): string {
  // Simplified QR code generation - in production, use a proper QR code library
  const size = 200;
  const modules = 25; // QR code grid size
  const moduleSize = size / modules;
  
  // Generate a simple pattern based on data hash
  const hash = data.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  
  // Generate pattern
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      const shouldFill = ((x + y + hash) % 3) === 0;
      if (shouldFill) {
        svg += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }
  
  svg += '</svg>';
  return svg;
}
