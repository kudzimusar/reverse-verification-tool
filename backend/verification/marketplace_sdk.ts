import { api } from "encore.dev/api";
import { verificationDB } from "./db";
import { secret } from "encore.dev/config";

const marketplaceApiKey = secret("MarketplaceAPIKey");

export interface MarketplaceIntegrationConfig {
  partnerId: string;
  webhookUrl?: string;
  autoVerify: boolean;
  autoFlag: boolean;
  blockStolenDevices: boolean;
}

export interface ListingVerificationRequest {
  listingId: string;
  deviceImei: string;
  sellerId: string;
  price: number;
  marketplace: string;
}

export interface ListingVerificationResponse {
  listingId: string;
  verified: boolean;
  trustScore: number;
  status: string;
  warnings: string[];
  recommendations: string[];
  blockListing: boolean;
  deviceInfo: {
    imei: string;
    manufacturer?: string;
    model?: string;
    verificationCount: number;
    reportCount: number;
    lastVerified?: Date;
  };
}

export const verifyListing = api(
  { method: "POST", path: "/marketplace/listings/verify", expose: true, auth: true },
  async (req: ListingVerificationRequest): Promise<ListingVerificationResponse> => {
    const device = await verificationDB.queryRow`
      SELECT 
        id,
        imei,
        status,
        manufacturer,
        model,
        trust_score,
        verification_count,
        report_count,
        flagged_reason,
        updated_at
      FROM devices
      WHERE imei = ${req.deviceImei}
    `;

    let trustScore = 50;
    let verified = false;
    let status = "unknown";
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let blockListing = false;

    if (device) {
      trustScore = parseFloat(device.trust_score) || 0;
      status = device.status;
      verified = status === "verified";

      if (status === "stolen" || status === "reported") {
        blockListing = true;
        warnings.push("Device has been reported as stolen or lost");
        recommendations.push("Do not proceed with this listing - device is flagged in our system");
      } else if (status === "flagged") {
        warnings.push(`Device is flagged: ${device.flagged_reason || "Unknown reason"}`);
        recommendations.push("Verify seller identity and request additional proof of ownership");
      }

      if (trustScore < 30) {
        warnings.push("Low trust score - device has insufficient verification history");
        recommendations.push("Request additional documentation from seller");
      } else if (trustScore < 50) {
        warnings.push("Moderate trust score - limited verification history");
      }

      if (parseInt(device.report_count) > 0) {
        warnings.push(`Device has ${device.report_count} report(s) on file`);
      }

      if (parseInt(device.verification_count) === 0) {
        recommendations.push("This is the first verification - recommend seller verification badge program");
      }

      await verificationDB.exec`
        INSERT INTO verification_logs (device_id, verified_by, verification_type, result, metadata)
        VALUES (
          ${device.id},
          ${req.sellerId},
          'marketplace_listing',
          ${verified ? 'verified' : 'failed'},
          ${JSON.stringify({ listingId: req.listingId, marketplace: req.marketplace, price: req.price })}
        )
      `;
    } else {
      warnings.push("Device not found in verification database");
      recommendations.push("Device should be registered and verified before listing");
      
      await verificationDB.exec`
        INSERT INTO devices (imei, status, trust_score, source)
        VALUES (${req.deviceImei}, 'pending', 0, 'marketplace')
      `;
    }

    await verificationDB.exec`
      INSERT INTO marketplace_listings (listing_id, device_imei, seller_id, marketplace, price, verification_status, block_listing)
      VALUES (${req.listingId}, ${req.deviceImei}, ${req.sellerId}, ${req.marketplace}, ${req.price}, ${status}, ${blockListing})
      ON CONFLICT (listing_id) DO UPDATE SET
        verification_status = ${status},
        block_listing = ${blockListing},
        updated_at = NOW()
    `;

    return {
      listingId: req.listingId,
      verified,
      trustScore,
      status,
      warnings,
      recommendations,
      blockListing,
      deviceInfo: {
        imei: req.deviceImei,
        manufacturer: device?.manufacturer,
        model: device?.model,
        verificationCount: device ? parseInt(device.verification_count) : 0,
        reportCount: device ? parseInt(device.report_count) : 0,
        lastVerified: device?.updated_at,
      },
    };
  }
);

interface BulkListingVerificationRequest {
  listings: ListingVerificationRequest[];
}

interface BulkListingVerificationResponse {
  results: ListingVerificationResponse[];
  summary: {
    total: number;
    verified: number;
    blocked: number;
    warnings: number;
  };
}

export const verifyBulkListings = api(
  { method: "POST", path: "/marketplace/listings/verify-bulk", expose: true, auth: true },
  async (req: BulkListingVerificationRequest): Promise<BulkListingVerificationResponse> => {
    const results: ListingVerificationResponse[] = [];

    for (const listing of req.listings) {
      const result = await verifyListing(listing);
      results.push(result);
    }

    const summary = {
      total: results.length,
      verified: results.filter(r => r.verified).length,
      blocked: results.filter(r => r.blockListing).length,
      warnings: results.filter(r => r.warnings.length > 0).length,
    };

    return { results, summary };
  }
);

interface MarketplaceWebhookEvent {
  eventType: "listing_created" | "listing_sold" | "listing_flagged" | "listing_removed";
  listingId: string;
  deviceImei?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export const handleWebhook = api(
  { method: "POST", path: "/marketplace/webhook", expose: true },
  async (event: MarketplaceWebhookEvent): Promise<{ success: boolean }> => {
    await verificationDB.exec`
      INSERT INTO marketplace_events (event_type, listing_id, device_imei, metadata, created_at)
      VALUES (${event.eventType}, ${event.listingId}, ${event.deviceImei}, ${JSON.stringify(event.metadata)}, NOW())
    `;

    if (event.eventType === "listing_sold" && event.deviceImei) {
      const device = await verificationDB.queryRow`
        SELECT id FROM devices WHERE imei = ${event.deviceImei}
      `;

      if (device) {
        await verificationDB.exec`
          INSERT INTO lifecycle_events (device_id, event_type, metadata)
          VALUES (${device.id}, 'ownership_transfer', ${JSON.stringify({ source: 'marketplace', listingId: event.listingId })})
        `;
      }
    }

    return { success: true };
  }
);

interface MarketplaceAnalyticsResponse {
  totalListings: number;
  verifiedListings: number;
  blockedListings: number;
  averageTrustScore: number;
  topMarketplaces: Array<{ marketplace: string; count: number }>;
  recentActivity: Array<{
    listingId: string;
    marketplace: string;
    status: string;
    createdAt: Date;
  }>;
}

export const getMarketplaceAnalytics = api(
  { method: "GET", path: "/marketplace/analytics", expose: true, auth: true },
  async (): Promise<MarketplaceAnalyticsResponse> => {
    const stats = await verificationDB.queryRow`
      SELECT 
        COUNT(*) as total_listings,
        COUNT(*) FILTER (WHERE verification_status = 'verified') as verified_listings,
        COUNT(*) FILTER (WHERE block_listing = true) as blocked_listings,
        AVG(d.trust_score) as avg_trust_score
      FROM marketplace_listings ml
      LEFT JOIN devices d ON ml.device_imei = d.imei
    `;

    const topMarketplaces = await verificationDB.query`
      SELECT marketplace, COUNT(*) as count
      FROM marketplace_listings
      GROUP BY marketplace
      ORDER BY count DESC
      LIMIT 10
    `;

    const recentActivity = await verificationDB.query`
      SELECT listing_id, marketplace, verification_status, created_at
      FROM marketplace_listings
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return {
      totalListings: parseInt(stats.total_listings) || 0,
      verifiedListings: parseInt(stats.verified_listings) || 0,
      blockedListings: parseInt(stats.blocked_listings) || 0,
      averageTrustScore: parseFloat(stats.avg_trust_score) || 0,
      topMarketplaces: topMarketplaces.map(m => ({
        marketplace: m.marketplace,
        count: parseInt(m.count),
      })),
      recentActivity: recentActivity.map(a => ({
        listingId: a.listing_id,
        marketplace: a.marketplace,
        status: a.verification_status,
        createdAt: a.created_at,
      })),
    };
  }
);
