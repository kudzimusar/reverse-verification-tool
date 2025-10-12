import { api } from "encore.dev/api";
import { verificationDB } from "./db";

interface CompareDevicesRequest {
  deviceIds: string[];
}

interface DeviceComparisonData {
  deviceId: string;
  imei: string;
  status: string;
  manufacturer?: string;
  model?: string;
  trustScore: number;
  verificationCount: number;
  reportCount: number;
  watcherCount: number;
  lastVerified?: Date;
  lastReported?: Date;
  flaggedReason?: string;
  ownershipHistory: number;
  createdAt: Date;
}

interface ComparisonMetrics {
  highestTrustScore: number;
  lowestTrustScore: number;
  averageTrustScore: number;
  mostVerified: string;
  mostReported: string;
  recommendations: string[];
}

export interface CompareDevicesResponse {
  devices: DeviceComparisonData[];
  metrics: ComparisonMetrics;
  comparison: {
    safest: string;
    riskiest: string;
    differences: string[];
  };
}

export const compareDevices = api(
  { method: "POST", path: "/devices/compare", expose: true },
  async (req: CompareDevicesRequest): Promise<CompareDevicesResponse> => {
    if (!req.deviceIds || req.deviceIds.length < 2) {
      throw new Error("At least 2 devices are required for comparison");
    }

    if (req.deviceIds.length > 5) {
      throw new Error("Maximum 5 devices can be compared at once");
    }

    const devicesGen = await verificationDB.query`
      SELECT 
        d.id,
        d.imei,
        d.status,
        d.manufacturer,
        d.model,
        d.trust_score,
        d.verification_count,
        d.report_count,
        d.flagged_reason,
        d.created_at,
        d.updated_at,
        COUNT(DISTINCT w.id) as watcher_count,
        COUNT(DISTINCT lc.id) as ownership_history,
        MAX(vl.created_at) as last_verified,
        MAX(r.created_at) as last_reported
      FROM devices d
      LEFT JOIN device_watchers w ON d.id = w.device_id
      LEFT JOIN lifecycle_events lc ON d.id = lc.device_id AND lc.event_type = 'ownership_transfer'
      LEFT JOIN verification_logs vl ON d.id = vl.device_id
      LEFT JOIN reports r ON d.id = r.device_id
      WHERE d.id = ANY(${req.deviceIds})
      GROUP BY d.id, d.imei, d.status, d.manufacturer, d.model, d.trust_score, 
               d.verification_count, d.report_count, d.flagged_reason, d.created_at, d.updated_at
    `;

    const devices = [];
    for await (const row of devicesGen) {
      devices.push(row);
    }

    if (devices.length !== req.deviceIds.length) {
      throw new Error("One or more devices not found");
    }

    const deviceData: DeviceComparisonData[] = devices.map(d => ({
      deviceId: d.id,
      imei: d.imei,
      status: d.status,
      manufacturer: d.manufacturer,
      model: d.model,
      trustScore: parseFloat(d.trust_score) || 0,
      verificationCount: parseInt(d.verification_count) || 0,
      reportCount: parseInt(d.report_count) || 0,
      watcherCount: parseInt(d.watcher_count) || 0,
      lastVerified: d.last_verified,
      lastReported: d.last_reported,
      flaggedReason: d.flagged_reason,
      ownershipHistory: parseInt(d.ownership_history) || 0,
      createdAt: d.created_at,
    }));

    const trustScores = deviceData.map(d => d.trustScore);
    const highestTrustScore = Math.max(...trustScores);
    const lowestTrustScore = Math.min(...trustScores);
    const averageTrustScore = trustScores.reduce((a, b) => a + b, 0) / trustScores.length;

    const mostVerified = deviceData.reduce((prev, curr) => 
      curr.verificationCount > prev.verificationCount ? curr : prev
    ).deviceId;

    const mostReported = deviceData.reduce((prev, curr) => 
      curr.reportCount > prev.reportCount ? curr : prev
    ).deviceId;

    const safest = deviceData.reduce((prev, curr) => 
      curr.trustScore > prev.trustScore ? curr : prev
    ).deviceId;

    const riskiest = deviceData.reduce((prev, curr) => 
      curr.trustScore < prev.trustScore ? curr : prev
    ).deviceId;

    const recommendations: string[] = [];
    const differences: string[] = [];

    const flaggedDevices = deviceData.filter(d => d.status === "flagged" || d.status === "reported");
    if (flaggedDevices.length > 0) {
      recommendations.push(`${flaggedDevices.length} device(s) have been flagged or reported - exercise caution`);
      differences.push(`Status variations: ${flaggedDevices.length} flagged/reported vs ${deviceData.length - flaggedDevices.length} clean`);
    }

    const lowTrustDevices = deviceData.filter(d => d.trustScore < 50);
    if (lowTrustDevices.length > 0) {
      recommendations.push(`${lowTrustDevices.length} device(s) have low trust scores (< 50)`);
    }

    const highTrustDevices = deviceData.filter(d => d.trustScore >= 80);
    if (highTrustDevices.length > 0) {
      recommendations.push(`${highTrustDevices.length} device(s) have high trust scores (≥ 80) - recommended`);
    }

    const trustScoreRange = highestTrustScore - lowestTrustScore;
    if (trustScoreRange > 30) {
      differences.push(`Large trust score variation: ${trustScoreRange.toFixed(1)} points`);
    }

    const verificationCounts = deviceData.map(d => d.verificationCount);
    const maxVerifications = Math.max(...verificationCounts);
    const minVerifications = Math.min(...verificationCounts);
    if (maxVerifications - minVerifications > 10) {
      differences.push(`Verification history varies: ${minVerifications} to ${maxVerifications} checks`);
    }

    const manufacturers = [...new Set(deviceData.map(d => d.manufacturer).filter(Boolean))];
    if (manufacturers.length > 1) {
      differences.push(`Multiple manufacturers: ${manufacturers.join(", ")}`);
    }

    return {
      devices: deviceData,
      metrics: {
        highestTrustScore,
        lowestTrustScore,
        averageTrustScore,
        mostVerified,
        mostReported,
        recommendations,
      },
      comparison: {
        safest,
        riskiest,
        differences,
      },
    };
  }
);
