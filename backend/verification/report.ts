import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface ReportDeviceRequest {
  deviceId: number;
  reporterAlias: string;
  reportType: "stolen" | "fraud" | "tampered" | "fake" | "other";
  description: string;
  evidenceUrls?: string[];
}

export interface ReportDeviceResponse {
  reportId: number;
  status: string;
}

// Reports a device for suspicious activity.
export const report = api<ReportDeviceRequest, ReportDeviceResponse>(
  { expose: true, method: "POST", path: "/report" },
  async (req) => {
    const { deviceId, reporterAlias, reportType, description, evidenceUrls } = req;

    const result = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO reports (device_id, reporter_alias, report_type, description, evidence_urls)
      VALUES (${deviceId}, ${reporterAlias}, ${reportType}, ${description}, ${evidenceUrls || []})
      RETURNING id
    `;

    // Update device status if it's a serious report
    if (reportType === "stolen" || reportType === "fraud") {
      await verificationDB.exec`
        UPDATE devices 
        SET status = 'flagged', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${deviceId}
      `;
    } else {
      await verificationDB.exec`
        UPDATE devices 
        SET status = 'under_investigation', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${deviceId}
      `;
    }

    return {
      reportId: result!.id,
      status: "submitted",
    };
  }
);
