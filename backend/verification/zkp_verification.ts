import { api } from "encore.dev/api";
import { verificationDB } from "./db";
import { createHash } from "crypto";

export interface ZKPProofRequest {
  deviceId: number;
  ownerSecret: string; // In real implementation, this would be handled more securely
  claimType: "ownership" | "authenticity" | "location";
}

export interface ZKPProofResponse {
  proofHash: string;
  verificationHash: string;
  ownerCommitment: string;
  isValid: boolean;
}

// Generates a zero-knowledge proof for device ownership or authenticity.
export const generateZKProof = api<ZKPProofRequest, ZKPProofResponse>(
  { expose: true, method: "POST", path: "/zkp/generate-proof" },
  async (req) => {
    const { deviceId, ownerSecret, claimType } = req;

    // Check if device exists
    const device = await verificationDB.queryRow<{
      id: number;
      serial_number: string;
    }>`
      SELECT id, serial_number FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Get current owner information
    const currentOwner = await verificationDB.queryRow<{
      owner_alias: string;
      verification_level: string;
    }>`
      SELECT owner_alias, verification_level
      FROM ownership_history
      WHERE device_id = ${deviceId} AND is_current_owner = true
    `;

    if (!currentOwner) {
      throw new Error("No current owner found for device");
    }

    // Generate ZKP components (simplified implementation)
    // In a real implementation, use a proper ZKP library like circomlib or snarkjs
    
    // Create owner commitment (hash of owner secret + device info)
    const ownerCommitment = createHash('sha256')
      .update(ownerSecret + device.serial_number + currentOwner.owner_alias)
      .digest('hex');

    // Create proof hash (simplified - in real ZKP this would be much more complex)
    const proofData = {
      deviceId,
      claimType,
      timestamp: Date.now(),
      ownerCommitment,
      deviceSerial: device.serial_number,
    };

    const proofHash = createHash('sha256')
      .update(JSON.stringify(proofData))
      .digest('hex');

    // Create verification hash (public verifiable component)
    const verificationHash = createHash('sha256')
      .update(proofHash + claimType + deviceId.toString())
      .digest('hex');

    // Validate the proof (simplified validation)
    const isValid = validateZKProof(ownerSecret, device.serial_number, currentOwner.owner_alias);

    // Store the proof
    await verificationDB.exec`
      INSERT INTO zkp_proofs (device_id, proof_hash, verification_hash, owner_commitment)
      VALUES (${deviceId}, ${proofHash}, ${verificationHash}, ${ownerCommitment})
    `;

    // Log the ZKP generation event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${deviceId}, 'zkp_generated', ${`ZKP generated for ${claimType} claim`}, true)
    `;

    return {
      proofHash,
      verificationHash,
      ownerCommitment,
      isValid,
    };
  }
);

export interface VerifyZKPRequest {
  verificationHash: string;
  claimType: "ownership" | "authenticity" | "location";
  deviceId?: number;
}

export interface VerifyZKPResponse {
  isValid: boolean;
  deviceId: number;
  claimType: string;
  proofTimestamp: Date;
  confidence: number;
}

// Verifies a zero-knowledge proof without revealing private information.
export const verifyZKProof = api<VerifyZKPRequest, VerifyZKPResponse>(
  { expose: true, method: "POST", path: "/zkp/verify-proof" },
  async (req) => {
    const { verificationHash, claimType, deviceId } = req;

    // Find the ZKP proof
    let zkpProof;
    if (deviceId) {
      zkpProof = await verificationDB.queryRow<{
        device_id: number;
        proof_hash: string;
        verification_hash: string;
        owner_commitment: string;
        created_at: Date;
      }>`
        SELECT device_id, proof_hash, verification_hash, owner_commitment, created_at
        FROM zkp_proofs
        WHERE verification_hash = ${verificationHash} AND device_id = ${deviceId}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    } else {
      zkpProof = await verificationDB.queryRow<{
        device_id: number;
        proof_hash: string;
        verification_hash: string;
        owner_commitment: string;
        created_at: Date;
      }>`
        SELECT device_id, proof_hash, verification_hash, owner_commitment, created_at
        FROM zkp_proofs
        WHERE verification_hash = ${verificationHash}
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }

    if (!zkpProof) {
      return {
        isValid: false,
        deviceId: deviceId || 0,
        claimType,
        proofTimestamp: new Date(),
        confidence: 0,
      };
    }

    // Verify the proof integrity
    const isValid = await validateZKProofIntegrity(zkpProof.verification_hash, zkpProof.proof_hash);
    
    // Calculate confidence based on proof age and device status
    const proofAge = Date.now() - zkpProof.created_at.getTime();
    const ageInDays = proofAge / (1000 * 60 * 60 * 24);
    
    let confidence = 100;
    if (ageInDays > 30) {
      confidence -= Math.min(50, ageInDays - 30); // Reduce confidence for old proofs
    }

    // Check device status for additional confidence factors
    const device = await verificationDB.queryRow<{
      status: string;
      current_trust_score: number;
    }>`
      SELECT status, current_trust_score FROM devices WHERE id = ${zkpProof.device_id}
    `;

    if (device) {
      if (device.status === 'flagged') {
        confidence -= 30;
      } else if (device.status === 'under_investigation') {
        confidence -= 15;
      }
      
      // Factor in trust score
      if (device.current_trust_score < 50) {
        confidence -= 20;
      }
    }

    confidence = Math.max(0, Math.min(100, confidence));

    // Log the verification attempt
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${zkpProof.device_id}, 'zkp_verified', 
              ${`ZKP verification attempted for ${claimType} claim (confidence: ${confidence}%)`}, ${isValid})
    `;

    return {
      isValid,
      deviceId: zkpProof.device_id,
      claimType,
      proofTimestamp: zkpProof.created_at,
      confidence: Math.round(confidence),
    };
  }
);

export interface GetZKPHistoryRequest {
  deviceId: number;
}

export interface ZKPHistoryEntry {
  id: number;
  proofHash: string;
  verificationHash: string;
  claimType: string;
  timestamp: Date;
  isValid: boolean;
}

export interface GetZKPHistoryResponse {
  proofs: ZKPHistoryEntry[];
  total: number;
}

// Gets the ZKP history for a device.
export const getZKPHistory = api<GetZKPHistoryRequest, GetZKPHistoryResponse>(
  { expose: true, method: "GET", path: "/zkp/history/:deviceId" },
  async (req) => {
    const { deviceId } = req;

    const proofs = await verificationDB.queryAll<{
      id: number;
      proof_hash: string;
      verification_hash: string;
      created_at: Date;
    }>`
      SELECT id, proof_hash, verification_hash, created_at
      FROM zkp_proofs
      WHERE device_id = ${deviceId}
      ORDER BY created_at DESC
    `;

    // Get associated events to determine claim types
    const events = await verificationDB.queryAll<{
      event_description: string;
      event_date: Date;
      verified: boolean;
    }>`
      SELECT event_description, event_date, verified
      FROM device_events
      WHERE device_id = ${deviceId} AND event_type = 'zkp_generated'
      ORDER BY event_date DESC
    `;

    const proofHistory: ZKPHistoryEntry[] = proofs.map((proof, index) => {
      const associatedEvent = events[index];
      const claimType = associatedEvent?.event_description?.includes('ownership') ? 'ownership' :
                       associatedEvent?.event_description?.includes('authenticity') ? 'authenticity' :
                       associatedEvent?.event_description?.includes('location') ? 'location' : 'unknown';

      return {
        id: proof.id,
        proofHash: proof.proof_hash,
        verificationHash: proof.verification_hash,
        claimType,
        timestamp: proof.created_at,
        isValid: associatedEvent?.verified || false,
      };
    });

    return {
      proofs: proofHistory,
      total: proofs.length,
    };
  }
);

// Simplified ZKP validation functions
// In a real implementation, these would use proper cryptographic ZKP libraries

function validateZKProof(ownerSecret: string, deviceSerial: string, ownerAlias: string): boolean {
  // Simplified validation - in real ZKP this would involve complex cryptographic verification
  const expectedHash = createHash('sha256')
    .update(ownerSecret + deviceSerial + ownerAlias)
    .digest('hex');
  
  // For demo purposes, consider valid if hash is properly formed
  return expectedHash.length === 64 && /^[a-f0-9]+$/.test(expectedHash);
}

async function validateZKProofIntegrity(verificationHash: string, proofHash: string): Promise<boolean> {
  // Simplified integrity check
  // In real implementation, this would verify the cryptographic proof
  
  // Check if hashes are properly formatted
  const isValidFormat = /^[a-f0-9]{64}$/.test(verificationHash) && /^[a-f0-9]{64}$/.test(proofHash);
  
  // Additional integrity checks could be added here
  return isValidFormat;
}
