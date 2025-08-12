import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface WatchDeviceRequest {
  deviceId: number;
  userEmail: string;
  userPhone?: string;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
}

export interface WatchDeviceResponse {
  watcherId: number;
  message: string;
}

// Allows users to watch a device for status changes.
export const watchDevice = api<WatchDeviceRequest, WatchDeviceResponse>(
  { expose: true, method: "POST", path: "/watch-device" },
  async (req) => {
    const { deviceId, userEmail, userPhone, notificationPreferences } = req;

    // Check if device exists
    const device = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Check if user is already watching this device
    const existingWatcher = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM device_watchers 
      WHERE device_id = ${deviceId} AND user_email = ${userEmail}
    `;

    if (existingWatcher) {
      // Update existing watcher
      await verificationDB.exec`
        UPDATE device_watchers 
        SET user_phone = ${userPhone || null},
            notification_preferences = ${JSON.stringify(notificationPreferences || { email: true, sms: false, push: false })}
        WHERE id = ${existingWatcher.id}
      `;

      return {
        watcherId: existingWatcher.id,
        message: "Watch preferences updated successfully",
      };
    }

    // Create new watcher
    const result = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO device_watchers (
        device_id, user_email, user_phone, notification_preferences
      ) VALUES (
        ${deviceId}, ${userEmail}, ${userPhone || null},
        ${JSON.stringify(notificationPreferences || { email: true, sms: false, push: false })}
      )
      RETURNING id
    `;

    return {
      watcherId: result!.id,
      message: "Device watch created successfully",
    };
  }
);

export interface UnwatchDeviceRequest {
  deviceId: number;
  userEmail: string;
}

export interface UnwatchDeviceResponse {
  message: string;
}

// Removes a device watch for a user.
export const unwatchDevice = api<UnwatchDeviceRequest, UnwatchDeviceResponse>(
  { expose: true, method: "DELETE", path: "/unwatch-device" },
  async (req) => {
    const { deviceId, userEmail } = req;

    await verificationDB.exec`
      DELETE FROM device_watchers 
      WHERE device_id = ${deviceId} AND user_email = ${userEmail}
    `;

    return {
      message: "Device watch removed successfully",
    };
  }
);

export interface CheckDeviceChangesRequest {
  deviceId?: number;
}

export interface DeviceChange {
  deviceId: number;
  changeType: "status_change" | "trust_score_drop";
  oldValue: string | number;
  newValue: string | number;
  severity: "low" | "medium" | "high";
}

export interface CheckDeviceChangesResponse {
  changes: DeviceChange[];
  notificationsSent: number;
}

// Checks for device changes and sends notifications to watchers.
export const checkDeviceChanges = api<CheckDeviceChangesRequest, CheckDeviceChangesResponse>(
  { expose: true, method: "POST", path: "/check-device-changes" },
  async (req) => {
    const { deviceId } = req;

    let whereConditions: string[] = [];
    if (deviceId) {
      whereConditions.push(`dw.device_id = ${deviceId}`);
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get all watchers and their devices
    const watchers = await verificationDB.queryAll<{
      watcher_id: number;
      device_id: number;
      user_email: string;
      user_phone?: string;
      notification_preferences: any;
      last_notified_at?: Date;
      device_status: string;
      current_trust_score: number;
      device_name: string;
    }>`
      SELECT dw.id as watcher_id, dw.device_id, dw.user_email, dw.user_phone,
             dw.notification_preferences, dw.last_notified_at,
             d.status as device_status, d.current_trust_score, d.device_name
      FROM device_watchers dw
      JOIN devices d ON dw.device_id = d.id
      ${whereClause}
    `;

    const changes: DeviceChange[] = [];
    let notificationsSent = 0;

    for (const watcher of watchers) {
      const deviceChanges: DeviceChange[] = [];

      // Check for status changes since last notification
      if (watcher.last_notified_at) {
        const recentReports = await verificationDB.queryAll<{
          report_type: string;
          created_at: Date;
        }>`
          SELECT report_type, created_at
          FROM reports
          WHERE device_id = ${watcher.device_id}
            AND created_at > ${watcher.last_notified_at}
            AND report_type IN ('stolen', 'fraud')
        `;

        if (recentReports.length > 0) {
          deviceChanges.push({
            deviceId: watcher.device_id,
            changeType: "status_change",
            oldValue: "clean",
            newValue: "flagged",
            severity: "high",
          });
        }
      }

      // Check for trust score drops
      const previousTrustScore = await verificationDB.queryRow<{
        score: number;
        calculated_at: Date;
      }>`
        SELECT score, calculated_at
        FROM trust_scores
        WHERE device_id = ${watcher.device_id}
          AND calculated_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY calculated_at DESC
        LIMIT 1
      `;

      if (previousTrustScore && watcher.current_trust_score < previousTrustScore.score - 15) {
        deviceChanges.push({
          deviceId: watcher.device_id,
          changeType: "trust_score_drop",
          oldValue: previousTrustScore.score,
          newValue: watcher.current_trust_score,
          severity: watcher.current_trust_score < 30 ? "high" : "medium",
        });
      }

      // Send notifications for changes
      if (deviceChanges.length > 0) {
        changes.push(...deviceChanges);

        for (const change of deviceChanges) {
          const message = generateNotificationMessage(watcher.device_name, change);
          
          // Send email notification
          if (watcher.notification_preferences.email) {
            await sendNotification(
              watcher.watcher_id,
              watcher.device_id,
              change.changeType,
              message,
              "email",
              watcher.user_email
            );
            notificationsSent++;
          }

          // Send SMS notification
          if (watcher.notification_preferences.sms && watcher.user_phone) {
            await sendNotification(
              watcher.watcher_id,
              watcher.device_id,
              change.changeType,
              message,
              "sms",
              watcher.user_phone
            );
            notificationsSent++;
          }
        }

        // Update last notified timestamp
        await verificationDB.exec`
          UPDATE device_watchers 
          SET last_notified_at = CURRENT_TIMESTAMP
          WHERE id = ${watcher.watcher_id}
        `;
      }
    }

    return {
      changes,
      notificationsSent,
    };
  }
);

function generateNotificationMessage(deviceName: string, change: DeviceChange): string {
  switch (change.changeType) {
    case "status_change":
      return `ALERT: Your watched device "${deviceName}" has been reported as ${change.newValue}. Please verify its status immediately.`;
    case "trust_score_drop":
      return `WARNING: Trust score for "${deviceName}" dropped from ${change.oldValue} to ${change.newValue}. Review device history for potential issues.`;
    default:
      return `UPDATE: Changes detected for your watched device "${deviceName}".`;
  }
}

async function sendNotification(
  watcherId: number,
  deviceId: number,
  notificationType: string,
  message: string,
  deliveryMethod: string,
  recipient: string
): Promise<void> {
  // In a real implementation, integrate with email/SMS services like SendGrid, Twilio, etc.
  // For now, just log the notification
  
  await verificationDB.exec`
    INSERT INTO notification_logs (
      device_id, watcher_id, notification_type, message, 
      delivery_method, delivery_status, sent_at
    ) VALUES (
      ${deviceId}, ${watcherId}, ${notificationType}, ${message},
      ${deliveryMethod}, 'sent', CURRENT_TIMESTAMP
    )
  `;

  // Simulate sending notification
  console.log(`Sending ${deliveryMethod} notification to ${recipient}: ${message}`);
}

export interface GetWatchedDevicesRequest {
  userEmail: string;
}

export interface WatchedDevice {
  watcherId: number;
  deviceId: number;
  deviceName: string;
  deviceStatus: string;
  trustScore: number;
  riskCategory: string;
  lastNotified?: Date;
  notificationPreferences: any;
}

export interface GetWatchedDevicesResponse {
  watchedDevices: WatchedDevice[];
  total: number;
}

// Gets all devices watched by a user.
export const getWatchedDevices = api<GetWatchedDevicesRequest, GetWatchedDevicesResponse>(
  { expose: true, method: "GET", path: "/watched-devices" },
  async (req) => {
    const { userEmail } = req;

    const watchedDevices = await verificationDB.queryAll<{
      watcher_id: number;
      device_id: number;
      device_name: string;
      status: string;
      current_trust_score: number;
      risk_category: string;
      last_notified_at?: Date;
      notification_preferences: any;
    }>`
      SELECT dw.id as watcher_id, dw.device_id, d.device_name, d.status,
             d.current_trust_score, d.risk_category, dw.last_notified_at,
             dw.notification_preferences
      FROM device_watchers dw
      JOIN devices d ON dw.device_id = d.id
      WHERE dw.user_email = ${userEmail}
      ORDER BY dw.created_at DESC
    `;

    return {
      watchedDevices: watchedDevices.map(wd => ({
        watcherId: wd.watcher_id,
        deviceId: wd.device_id,
        deviceName: wd.device_name,
        deviceStatus: wd.status,
        trustScore: wd.current_trust_score,
        riskCategory: wd.risk_category,
        lastNotified: wd.last_notified_at,
        notificationPreferences: wd.notification_preferences,
      })),
      total: watchedDevices.length,
    };
  }
);
