import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";
import { validateString, validateEnum, validateArray, validateURL, ValidationError } from "./validation";

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
    try {
      validateString(req.reporterAlias, "Reporter alias", 2, 100);
      validateEnum(req.reportType, "Report type", ["stolen", "fraud", "tampered", "fake", "other"] as const);
      validateString(req.description, "Description", 10, 5000);
      
      if (req.evidenceUrls) {
        validateArray(req.evidenceUrls, "Evidence URLs", 0, 10);
        req.evidenceUrls.forEach(url => validateURL(url, "Evidence URL"));
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw APIError.invalidArgument(error.message);
      }
      throw error;
    }

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
