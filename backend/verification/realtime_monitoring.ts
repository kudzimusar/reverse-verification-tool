import { api, StreamOut } from "encore.dev/api";
import { Topic } from "encore.dev/pubsub";
import { verificationDB } from "./db";

export interface DeviceStatusUpdate {
  deviceId: string;
  status: "verified" | "flagged" | "reported" | "stolen" | "under_review";
  timestamp: Date;
  updatedBy?: string;
  reason?: string;
}

export const deviceStatusTopic = new Topic<DeviceStatusUpdate>("device-status-updates", {
  deliveryGuarantee: "at-least-once",
});

interface MonitorDeviceRequest {
  deviceIds: string[];
}

export const monitorDevices = api(
  { method: "POST", path: "/monitoring/devices/stream", expose: true },
  async (req: MonitorDeviceRequest) => {
    const initialStatuses = await verificationDB.query`
      SELECT 
        id as device_id,
        status,
        updated_at,
        flagged_reason
      FROM devices
      WHERE id = ANY(${req.deviceIds})
    `;

    return {
      updates: initialStatuses.map(row => ({
        deviceId: row.device_id,
        status: row.status,
        timestamp: row.updated_at,
        reason: row.flagged_reason,
      })),
    };
  }
);

interface DeviceActivityEvent {
  deviceId: string;
  eventType: "verification" | "report" | "flag" | "watch" | "transfer";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export const deviceActivityTopic = new Topic<DeviceActivityEvent>("device-activity", {
  deliveryGuarantee: "at-least-once",
});

export const monitorActivity = api(
  { method: "GET", path: "/monitoring/activity", expose: true },
  async () => {
    const recentActivity = await verificationDB.query`
      SELECT 
        device_id::text as device_id,
        event_type,
        created_at as timestamp
      FROM device_events
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return {
      events: recentActivity.map(e => ({
        deviceId: e.device_id,
        eventType: e.event_type as any,
        timestamp: e.timestamp,
        metadata: {},
      })),
    };
  }
);

interface GlobalStatsUpdate {
  totalDevices: number;
  verifiedDevices: number;
  flaggedDevices: number;
  reportedDevices: number;
  verificationsLast24h: number;
  timestamp: Date;
}

export const globalStatsTopic = new Topic<GlobalStatsUpdate>("global-stats", {
  deliveryGuarantee: "at-least-once",
});

export const monitorGlobalStats = api(
  { method: "GET", path: "/monitoring/stats", expose: true },
  async () => {
    const stats = await verificationDB.query`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE status = 'verified') as verified_devices,
        COUNT(*) FILTER (WHERE status = 'flagged') as flagged_devices,
        COUNT(*) FILTER (WHERE status = 'reported') as reported_devices
      FROM devices
    `;

    const recentVerifications = await verificationDB.query`
      SELECT COUNT(*) as count
      FROM verification_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    return {
      totalDevices: parseInt(stats[0].total_devices),
      verifiedDevices: parseInt(stats[0].verified_devices),
      flaggedDevices: parseInt(stats[0].flagged_devices),
      reportedDevices: parseInt(stats[0].reported_devices),
      verificationsLast24h: parseInt(recentVerifications[0].count),
      timestamp: new Date(),
    };
  }
);
