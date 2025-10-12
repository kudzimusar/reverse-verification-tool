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
    const initialStatusesGen = await verificationDB.query`
      SELECT 
        id as device_id,
        status,
        updated_at,
        flagged_reason
      FROM devices
      WHERE id = ANY(${req.deviceIds})
    `;

    const initialStatuses = [];
    for await (const row of initialStatusesGen) {
      initialStatuses.push(row);
    }

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
    const recentActivityGen = await verificationDB.query`
      SELECT 
        device_id::text as device_id,
        event_type,
        created_at as timestamp
      FROM device_events
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const recentActivity = [];
    for await (const row of recentActivityGen) {
      recentActivity.push(row);
    }

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
    const statsGen = await verificationDB.query`
      SELECT 
        COUNT(*) as total_devices,
        COUNT(*) FILTER (WHERE status = 'verified') as verified_devices,
        COUNT(*) FILTER (WHERE status = 'flagged') as flagged_devices,
        COUNT(*) FILTER (WHERE status = 'reported') as reported_devices
      FROM devices
    `;

    const stats = [];
    for await (const row of statsGen) {
      stats.push(row);
    }

    const recentVerificationsGen = await verificationDB.query`
      SELECT COUNT(*) as count
      FROM verification_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `;

    const recentVerifications = [];
    for await (const row of recentVerificationsGen) {
      recentVerifications.push(row);
    }

    return {
      totalDevices: parseInt(stats[0]?.total_devices || '0'),
      verifiedDevices: parseInt(stats[0]?.verified_devices || '0'),
      flaggedDevices: parseInt(stats[0]?.flagged_devices || '0'),
      reportedDevices: parseInt(stats[0]?.reported_devices || '0'),
      verificationsLast24h: parseInt(recentVerifications[0]?.count || '0'),
      timestamp: new Date(),
    };
  }
);
