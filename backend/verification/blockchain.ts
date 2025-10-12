import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { verificationDB } from "./db";
import * as crypto from "crypto";

const blockchainApiKey = secret("BlockchainAPIKey");

export interface BlockchainRecord {
  id: string;
  deviceId: string;
  transactionHash: string;
  blockNumber: number;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: Date;
  verified: boolean;
}

export interface BlockchainVerificationRequest {
  deviceId: string;
  eventType: "verification" | "ownership_transfer" | "report" | "flag" | "recovery";
  data: Record<string, unknown>;
}

export interface BlockchainVerificationResponse {
  success: boolean;
  transactionHash: string;
  blockNumber: number;
  recordId: string;
  merkleRoot: string;
  proof: string[];
}

function generateMerkleTree(data: string[]): { root: string; proof: string[] } {
  if (data.length === 0) return { root: "", proof: [] };
  
  let layer = data.map(d => crypto.createHash('sha256').update(d).digest('hex'));
  const proof: string[] = [];
  
  while (layer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const combined = layer[i] + layer[i + 1];
        const hash = crypto.createHash('sha256').update(combined).digest('hex');
        nextLayer.push(hash);
        proof.push(layer[i + 1]);
      } else {
        nextLayer.push(layer[i]);
      }
    }
    layer = nextLayer;
  }
  
  return { root: layer[0], proof };
}

function generateTransactionHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export const recordOnBlockchain = api(
  { method: "POST", path: "/blockchain/record", expose: true, auth: true },
  async (req: BlockchainVerificationRequest): Promise<BlockchainVerificationResponse> => {
    const device = await verificationDB.queryRow`
      SELECT id, imei FROM devices WHERE id = ${req.deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    const recordData = {
      deviceId: req.deviceId,
      imei: device.imei,
      eventType: req.eventType,
      data: req.data,
      timestamp: new Date().toISOString(),
    };

    const dataString = JSON.stringify(recordData);
    const transactionHash = generateTransactionHash(dataString);
    
    const recentRecordsGen = await verificationDB.query`
      SELECT data_hash FROM blockchain_records
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const recentRecords = [];
    for await (const row of recentRecordsGen) {
      recentRecords.push(row);
    }

    const dataHashes = [
      transactionHash,
      ...recentRecords.map(r => r.data_hash)
    ];

    const { root: merkleRoot, proof } = generateMerkleTree(dataHashes);
    
    const blockNumber = Math.floor(Date.now() / 1000);

    const result = await verificationDB.queryRow`
      INSERT INTO blockchain_records (
        device_id,
        transaction_hash,
        block_number,
        event_type,
        data,
        merkle_root,
        merkle_proof,
        data_hash,
        verified
      ) VALUES (
        ${req.deviceId},
        ${transactionHash},
        ${blockNumber},
        ${req.eventType},
        ${JSON.stringify(req.data)},
        ${merkleRoot},
        ${JSON.stringify(proof)},
        ${transactionHash},
        true
      )
      RETURNING id
    `;

    await verificationDB.exec`
      UPDATE devices
      SET blockchain_verified = true, blockchain_tx_hash = ${transactionHash}
      WHERE id = ${req.deviceId}
    `;

    return {
      success: true,
      transactionHash,
      blockNumber,
      recordId: result?.id || '',
      merkleRoot,
      proof,
    };
  }
);

export interface VerifyBlockchainRecordRequest {
  transactionHash: string;
}

export interface VerifyBlockchainRecordResponse {
  valid: boolean;
  record?: BlockchainRecord;
  merkleRoot: string;
  verified: boolean;
  timestamp: Date;
}

export const verifyBlockchainRecord = api(
  { method: "POST", path: "/blockchain/verify", expose: true },
  async (req: VerifyBlockchainRecordRequest): Promise<VerifyBlockchainRecordResponse> => {
    const record = await verificationDB.queryRow`
      SELECT 
        id,
        device_id,
        transaction_hash,
        block_number,
        event_type,
        data,
        merkle_root,
        merkle_proof,
        data_hash,
        verified,
        created_at
      FROM blockchain_records
      WHERE transaction_hash = ${req.transactionHash}
    `;

    if (!record) {
      return {
        valid: false,
        merkleRoot: "",
        verified: false,
        timestamp: new Date(),
      };
    }

    const dataString = JSON.stringify({
      deviceId: record.device_id,
      eventType: record.event_type,
      data: record.data,
    });
    
    const computedHash = generateTransactionHash(dataString);
    const hashMatches = computedHash === record.data_hash;

    return {
      valid: hashMatches,
      record: {
        id: record.id,
        deviceId: record.device_id,
        transactionHash: record.transaction_hash,
        blockNumber: parseInt(record.block_number),
        eventType: record.event_type,
        data: record.data,
        timestamp: record.created_at,
        verified: record.verified,
      },
      merkleRoot: record.merkle_root,
      verified: record.verified && hashMatches,
      timestamp: record.created_at,
    };
  }
);

export interface GetBlockchainHistoryRequest {
  deviceId: string;
}

export interface GetBlockchainHistoryResponse {
  records: BlockchainRecord[];
  totalRecords: number;
  deviceVerified: boolean;
}

export const getBlockchainHistory = api(
  { method: "GET", path: "/blockchain/history/:deviceId", expose: true },
  async ({ deviceId }: GetBlockchainHistoryRequest): Promise<GetBlockchainHistoryResponse> => {
    const recordsGen = await verificationDB.query`
      SELECT 
        id,
        device_id,
        transaction_hash,
        block_number,
        event_type,
        data,
        verified,
        created_at
      FROM blockchain_records
      WHERE device_id = ${deviceId}
      ORDER BY created_at DESC
    `;

    const records = [];
    for await (const row of recordsGen) {
      records.push(row);
    }

    const device = await verificationDB.queryRow`
      SELECT blockchain_verified FROM devices WHERE id = ${deviceId}
    `;

    return {
      records: records.map(r => ({
        id: r.id,
        deviceId: r.device_id,
        transactionHash: r.transaction_hash,
        blockNumber: parseInt(r.block_number),
        eventType: r.event_type,
        data: r.data,
        timestamp: r.created_at,
        verified: r.verified,
      })),
      totalRecords: records.length,
      deviceVerified: device?.blockchain_verified || false,
    };
  }
);

export interface BlockchainAuditLogEntry {
  timestamp: Date;
  eventType: string;
  transactionHash: string;
  blockNumber: number;
  verified: boolean;
  dataHash: string;
}

export interface GetAuditLogResponse {
  entries: BlockchainAuditLogEntry[];
  merkleRoot: string;
  totalEntries: number;
}

export const getAuditLog = api(
  { method: "GET", path: "/blockchain/audit", expose: true, auth: true },
  async (): Promise<GetAuditLogResponse> => {
    const recordsGen = await verificationDB.query`
      SELECT 
        created_at,
        event_type,
        transaction_hash,
        block_number,
        verified,
        data_hash,
        merkle_root
      FROM blockchain_records
      ORDER BY created_at DESC
      LIMIT 1000
    `;

    const records = [];
    for await (const row of recordsGen) {
      records.push(row);
    }

    const latestMerkleRoot = records.length > 0 ? records[0].merkle_root : "";

    return {
      entries: records.map(r => ({
        timestamp: r.created_at,
        eventType: r.event_type,
        transactionHash: r.transaction_hash,
        blockNumber: parseInt(r.block_number),
        verified: r.verified,
        dataHash: r.data_hash,
      })),
      merkleRoot: latestMerkleRoot,
      totalEntries: records.length,
    };
  }
);

export interface BatchBlockchainRecordRequest {
  records: BlockchainVerificationRequest[];
}

export interface BatchBlockchainRecordResponse {
  results: BlockchainVerificationResponse[];
  batchMerkleRoot: string;
  totalRecorded: number;
}

export const batchRecordOnBlockchain = api(
  { method: "POST", path: "/blockchain/batch-record", expose: true, auth: true },
  async (req: BatchBlockchainRecordRequest): Promise<BatchBlockchainRecordResponse> => {
    const results: BlockchainVerificationResponse[] = [];

    for (const record of req.records) {
      try {
        const result = await recordOnBlockchain(record);
        results.push(result);
      } catch (error) {
        console.error(`Failed to record ${record.deviceId}:`, error);
      }
    }

    const allHashes = results.map(r => r.transactionHash);
    const { root: batchMerkleRoot } = generateMerkleTree(allHashes);

    return {
      results,
      batchMerkleRoot,
      totalRecorded: results.length,
    };
  }
);
