import { api, APIError } from "encore.dev/api";
import { verificationDB } from "./db";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

export interface LawEnforcementReportRequest {
  deviceId: number;
  reportType: "stolen" | "fraud" | "evidence" | "investigation";
  jurisdiction: string;
  caseNumber?: string;
  reportData: {
    incidentDate?: Date;
    location?: string;
    description: string;
    officerBadge?: string;
    departmentCode?: string;
    evidencePhotos?: string[];
    witnessStatements?: string[];
  };
  reporterId: number; // Partner ID from partners table
}

export interface LawEnforcementReportResponse {
  reportId: number;
  encryptedDataHash: string;
  blockchainProofHash: string;
  status: string;
  submissionTimestamp: Date;
}

// Submits a report to law enforcement databases with encryption.
export const submitLawEnforcementReport = api<LawEnforcementReportRequest, LawEnforcementReportResponse>(
  { expose: true, method: "POST", path: "/law-enforcement/report" },
  async (req) => {
    const { deviceId, reportType, jurisdiction, caseNumber, reportData, reporterId } = req;

    // Verify reporter is authorized law enforcement partner
    const partner = await verificationDB.queryRow<{
      id: number;
      name: string;
      partner_type: string;
      is_active: boolean;
    }>`
      SELECT id, name, partner_type, is_active
      FROM partners
      WHERE id = ${reporterId} AND partner_type = 'law_enforcement' AND is_active = true
    `;

    if (!partner) {
      throw APIError.permissionDenied("Unauthorized: Only verified law enforcement partners can submit reports");
    }

    // Verify device exists
    const device = await verificationDB.queryRow<{
      id: number;
      serial_number: string;
      device_name: string;
    }>`
      SELECT id, serial_number, device_name FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw APIError.notFound("Device not found");
    }

    // Encrypt sensitive report data
    const encryptionResult = encryptReportData(reportData);
    
    // Generate blockchain proof hash
    const blockchainProofHash = generateBlockchainProof({
      deviceId,
      reportType,
      jurisdiction,
      reporterId,
      timestamp: new Date(),
      dataHash: encryptionResult.dataHash,
    });

    // Store encrypted report
    const result = await verificationDB.queryRow<{ id: number }>`
      INSERT INTO law_enforcement_reports (
        device_id, reporter_id, report_type, jurisdiction, case_number,
        encrypted_data, encryption_key_hash, blockchain_proof_hash, status
      ) VALUES (
        ${deviceId}, ${reporterId}, ${reportType}, ${jurisdiction}, ${caseNumber || null},
        ${encryptionResult.encryptedData}, ${encryptionResult.keyHash}, 
        ${blockchainProofHash}, 'submitted'
      )
      RETURNING id
    `;

    // Update device status based on report type
    if (reportType === 'stolen') {
      await verificationDB.exec`
        UPDATE devices 
        SET status = 'flagged', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${deviceId}
      `;
    } else if (reportType === 'investigation' || reportType === 'evidence') {
      await verificationDB.exec`
        UPDATE devices 
        SET status = 'under_investigation', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${deviceId}
      `;
    }

    // Log the law enforcement action
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (
        ${deviceId}, 'law_enforcement_report', 
        ${`${reportType} report submitted by ${partner.name} (Case: ${caseNumber || 'N/A'})`},
        ${partner.name}, true
      )
    `;

    // Create a regular report entry for transparency
    await verificationDB.exec`
      INSERT INTO reports (device_id, reporter_alias, report_type, description, status)
      VALUES (
        ${deviceId}, ${partner.name}, ${reportType}, 
        ${`Law enforcement report: ${reportData.description}`}, 'verified'
      )
    `;

    return {
      reportId: result!.id,
      encryptedDataHash: encryptionResult.dataHash,
      blockchainProofHash,
      status: 'submitted',
      submissionTimestamp: new Date(),
    };
  }
);

export interface GetLawEnforcementReportsRequest {
  deviceId?: number;
  jurisdiction?: string;
  reportType?: string;
  reporterId?: number;
  limit?: number;
}

export interface LawEnforcementReportSummary {
  reportId: number;
  deviceId: number;
  deviceName: string;
  reportType: string;
  jurisdiction: string;
  caseNumber?: string;
  reporterName: string;
  status: string;
  submissionDate: Date;
  blockchainProofHash: string;
}

export interface GetLawEnforcementReportsResponse {
  reports: LawEnforcementReportSummary[];
  total: number;
}

// Gets law enforcement reports (summary only for security).
export const getLawEnforcementReports = api<GetLawEnforcementReportsRequest, GetLawEnforcementReportsResponse>(
  { expose: true, method: "GET", path: "/law-enforcement/reports" },
  async (req) => {
    const { deviceId, jurisdiction, reportType, reporterId, limit = 50 } = req;

    let whereConditions: string[] = [];
    
    if (deviceId) {
      whereConditions.push(`ler.device_id = ${deviceId}`);
    }

    if (jurisdiction) {
      whereConditions.push(`ler.jurisdiction = '${jurisdiction}'`);
    }

    if (reportType) {
      whereConditions.push(`ler.report_type = '${reportType}'`);
    }

    if (reporterId) {
      whereConditions.push(`ler.reporter_id = ${reporterId}`);
    }

    let query = `
      SELECT ler.id, ler.device_id, d.device_name, ler.report_type,
             ler.jurisdiction, ler.case_number, p.name as partner_name,
             ler.status, ler.created_at, ler.blockchain_proof_hash
      FROM law_enforcement_reports ler
      JOIN devices d ON ler.device_id = d.id
      JOIN partners p ON ler.reporter_id = p.id
    `;

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += ` ORDER BY ler.created_at DESC LIMIT ${limit}`;

    const reports = await verificationDB.queryAll<{
      id: number;
      device_id: number;
      device_name: string;
      report_type: string;
      jurisdiction: string;
      case_number?: string;
      partner_name: string;
      status: string;
      created_at: Date;
      blockchain_proof_hash: string;
    }>(query);

    let countQuery = `SELECT COUNT(*) as count FROM law_enforcement_reports ler`;
    if (whereConditions.length > 0) {
      countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const totalResult = await verificationDB.queryRow<{ count: number }>(countQuery);

    return {
      reports: reports.map(report => ({
        reportId: report.id,
        deviceId: report.device_id,
        deviceName: report.device_name,
        reportType: report.report_type,
        jurisdiction: report.jurisdiction,
        caseNumber: report.case_number,
        reporterName: report.partner_name,
        status: report.status,
        submissionDate: report.created_at,
        blockchainProofHash: report.blockchain_proof_hash,
      })),
      total: totalResult?.count || 0,
    };
  }
);

export interface DecryptReportRequest {
  reportId: number;
  requesterId: number;
  decryptionKey: string;
}

export interface DecryptReportResponse {
  reportData: any;
  isAuthorized: boolean;
  accessLogged: boolean;
}

// Decrypts a law enforcement report (restricted access).
export const decryptLawEnforcementReport = api<DecryptReportRequest, DecryptReportResponse>(
  { expose: true, method: "POST", path: "/law-enforcement/decrypt" },
  async (req) => {
    const { reportId, requesterId, decryptionKey } = req;

    // Verify requester is authorized
    const requester = await verificationDB.queryRow<{
      id: number;
      name: string;
      partner_type: string;
      is_active: boolean;
    }>`
      SELECT id, name, partner_type, is_active
      FROM partners
      WHERE id = ${requesterId} AND partner_type = 'law_enforcement' AND is_active = true
    `;

    if (!requester) {
      throw APIError.permissionDenied("Unauthorized: Only verified law enforcement partners can decrypt reports");
    }

    // Get the encrypted report
    const report = await verificationDB.queryRow<{
      id: number;
      device_id: number;
      encrypted_data: string;
      encryption_key_hash: string;
      jurisdiction: string;
      reporter_id: number;
    }>`
      SELECT id, device_id, encrypted_data, encryption_key_hash, jurisdiction, reporter_id
      FROM law_enforcement_reports
      WHERE id = ${reportId}
    `;

    if (!report) {
      throw APIError.notFound("Report not found");
    }

    // Verify decryption key
    const keyHash = createHash('sha256').update(decryptionKey).digest('hex');
    const isAuthorized = keyHash === report.encryption_key_hash;

    let reportData = null;
    if (isAuthorized) {
      try {
        reportData = decryptReportData(report.encrypted_data, decryptionKey);
      } catch (error) {
        throw APIError.invalidArgument("Invalid decryption key");
      }
    }

    // Log access attempt
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, provider_name, verified)
      VALUES (
        ${report.device_id}, 'law_enforcement_access',
        ${`Report ${reportId} access attempt by ${requester.name} (${isAuthorized ? 'SUCCESS' : 'FAILED'})`},
        ${requester.name}, ${isAuthorized}
      )
    `;

    return {
      reportData,
      isAuthorized,
      accessLogged: true,
    };
  }
);

export interface BlockchainProofRequest {
  reportId: number;
}

export interface BlockchainProofResponse {
  reportId: number;
  proofHash: string;
  blockchainTxId?: string;
  verificationUrl?: string;
  isValid: boolean;
}

// Verifies the blockchain proof for a law enforcement report.
export const verifyBlockchainProof = api<BlockchainProofRequest, BlockchainProofResponse>(
  { expose: true, method: "GET", path: "/law-enforcement/verify-proof/:reportId" },
  async (req) => {
    const { reportId } = req;

    const report = await verificationDB.queryRow<{
      id: number;
      blockchain_proof_hash: string;
      created_at: Date;
    }>`
      SELECT id, blockchain_proof_hash, created_at
      FROM law_enforcement_reports
      WHERE id = ${reportId}
    `;

    if (!report) {
      throw APIError.notFound("Report not found");
    }

    // In a real implementation, this would verify against the actual blockchain
    const isValid = await verifyBlockchainProofHash(report.blockchain_proof_hash);
    
    // Generate mock blockchain transaction ID for demo
    const blockchainTxId = `0x${report.blockchain_proof_hash.substring(0, 16)}...`;
    const verificationUrl = `https://blockchain-explorer.com/tx/${blockchainTxId}`;

    return {
      reportId: report.id,
      proofHash: report.blockchain_proof_hash,
      blockchainTxId,
      verificationUrl,
      isValid,
    };
  }
);

// Encryption/Decryption utilities
function encryptReportData(reportData: any): {
  encryptedData: string;
  keyHash: string;
  dataHash: string;
} {
  // Generate encryption key
  const encryptionKey = randomBytes(32);
  const iv = randomBytes(16);
  
  // Encrypt data
  const cipher = createCipheriv('aes-256-cbc', encryptionKey, iv);
  const dataString = JSON.stringify(reportData);
  let encrypted = cipher.update(dataString, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Combine IV and encrypted data
  const encryptedData = iv.toString('hex') + ':' + encrypted;
  
  // Create hashes
  const keyHash = createHash('sha256').update(encryptionKey).digest('hex');
  const dataHash = createHash('sha256').update(dataString).digest('hex');
  
  return {
    encryptedData,
    keyHash,
    dataHash,
  };
}

function decryptReportData(encryptedData: string, decryptionKey: string): any {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(decryptionKey, 'hex');
  
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

function generateBlockchainProof(data: any): string {
  // Simplified blockchain proof generation
  // In real implementation, this would interact with actual blockchain
  const proofData = {
    ...data,
    timestamp: data.timestamp.toISOString(),
    nonce: randomBytes(16).toString('hex'),
  };
  
  return createHash('sha256')
    .update(JSON.stringify(proofData))
    .digest('hex');
}

async function verifyBlockchainProofHash(proofHash: string): Promise<boolean> {
  // Simplified verification - in real implementation, query blockchain
  // For demo purposes, consider valid if properly formatted
  return /^[a-f0-9]{64}$/.test(proofHash);
}
