import { api } from "encore.dev/api";
import { verificationDB } from "./db";
import { createHash } from "crypto";

export interface DeviceFingerprintData {
  sensorPatterns?: {
    accelerometer?: number[];
    gyroscope?: number[];
    magnetometer?: number[];
  };
  cpuGpuId?: string;
  macAddresses?: string[];
}

export interface CreateFingerprintRequest {
  deviceId: number;
  fingerprintData: DeviceFingerprintData;
}

export interface CreateFingerprintResponse {
  fingerprintHash: string;
  message: string;
}

// Creates a device fingerprint for enhanced verification.
export const createFingerprint = api<CreateFingerprintRequest, CreateFingerprintResponse>(
  { expose: true, method: "POST", path: "/fingerprint/create" },
  async (req) => {
    const { deviceId, fingerprintData } = req;

    // Check if device exists
    const device = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    // Generate fingerprint hash
    const fingerprintString = JSON.stringify({
      sensors: fingerprintData.sensorPatterns,
      cpu_gpu: fingerprintData.cpuGpuId,
      mac_addresses: fingerprintData.macAddresses?.sort(), // Sort for consistency
    });

    const fingerprintHash = createHash('sha256')
      .update(fingerprintString)
      .digest('hex');

    // Check if fingerprint already exists
    const existingFingerprint = await verificationDB.queryRow<{ id: number }>`
      SELECT id FROM device_fingerprints 
      WHERE device_id = ${deviceId}
    `;

    if (existingFingerprint) {
      // Update existing fingerprint
      await verificationDB.exec`
        UPDATE device_fingerprints 
        SET fingerprint_hash = ${fingerprintHash},
            sensor_patterns = ${JSON.stringify(fingerprintData.sensorPatterns)},
            cpu_gpu_id = ${fingerprintData.cpuGpuId || null},
            mac_addresses = ${fingerprintData.macAddresses || []},
            created_at = CURRENT_TIMESTAMP
        WHERE device_id = ${deviceId}
      `;
    } else {
      // Create new fingerprint
      await verificationDB.exec`
        INSERT INTO device_fingerprints (
          device_id, fingerprint_hash, sensor_patterns, cpu_gpu_id, mac_addresses
        ) VALUES (
          ${deviceId}, ${fingerprintHash}, 
          ${JSON.stringify(fingerprintData.sensorPatterns)},
          ${fingerprintData.cpuGpuId || null}, ${fingerprintData.macAddresses || []}
        )
      `;
    }

    // Log fingerprint creation event
    await verificationDB.exec`
      INSERT INTO device_events (device_id, event_type, event_description, verified)
      VALUES (${deviceId}, 'fingerprint_created', 'Device fingerprint generated', true)
    `;

    return {
      fingerprintHash,
      message: "Device fingerprint created successfully",
    };
  }
);

export interface VerifyFingerprintRequest {
  identifier: string;
  identifierType: "serial" | "imei" | "fingerprint";
  fingerprintData?: DeviceFingerprintData;
}

export interface FingerprintMatch {
  deviceId: number;
  serialNumber: string;
  deviceName: string;
  matchScore: number;
  matchType: "exact" | "partial" | "none";
  matchedComponents: string[];
}

export interface VerifyFingerprintResponse {
  matches: FingerprintMatch[];
  primaryMatch?: FingerprintMatch;
  verificationResult: "verified" | "suspicious" | "not_found";
}

// Verifies a device using fingerprint data.
export const verifyFingerprint = api<VerifyFingerprintRequest, VerifyFingerprintResponse>(
  { expose: true, method: "POST", path: "/fingerprint/verify" },
  async (req) => {
    const { identifier, identifierType, fingerprintData } = req;

    let matches: FingerprintMatch[] = [];

    if (identifierType === "fingerprint") {
      // Direct fingerprint hash lookup
      const fingerprintHash = identifier;
      
      const fingerprintMatch = await verificationDB.queryRow<{
        device_id: number;
        serial_number: string;
        device_name: string;
      }>`
        SELECT df.device_id, d.serial_number, d.device_name
        FROM device_fingerprints df
        JOIN devices d ON df.device_id = d.id
        WHERE df.fingerprint_hash = ${fingerprintHash}
      `;

      if (fingerprintMatch) {
        matches.push({
          deviceId: fingerprintMatch.device_id,
          serialNumber: fingerprintMatch.serial_number,
          deviceName: fingerprintMatch.device_name,
          matchScore: 100,
          matchType: "exact",
          matchedComponents: ["fingerprint_hash"],
        });
      }
    } else {
      // Traditional identifier lookup with fingerprint cross-verification
      const device = await verificationDB.queryRow<{
        id: number;
        serial_number: string;
        device_name: string;
      }>`
        SELECT id, serial_number, device_name
        FROM devices 
        WHERE ${identifierType === 'serial' ? 'serial_number' : 'imei'} = ${identifier}
      `;

      if (device) {
        let matchScore = 50; // Base score for identifier match
        let matchedComponents = [identifierType];
        let matchType: "exact" | "partial" | "none" = "partial";

        // Check fingerprint if provided
        if (fingerprintData) {
          const storedFingerprint = await verificationDB.queryRow<{
            fingerprint_hash: string;
            sensor_patterns: any;
            cpu_gpu_id?: string;
            mac_addresses: string[];
          }>`
            SELECT fingerprint_hash, sensor_patterns, cpu_gpu_id, mac_addresses
            FROM device_fingerprints
            WHERE device_id = ${device.id}
          `;

          if (storedFingerprint) {
            // Calculate fingerprint similarity
            const similarity = calculateFingerprintSimilarity(
              fingerprintData,
              {
                sensorPatterns: storedFingerprint.sensor_patterns,
                cpuGpuId: storedFingerprint.cpu_gpu_id,
                macAddresses: storedFingerprint.mac_addresses,
              }
            );

            matchScore += similarity.score;
            matchedComponents.push(...similarity.matchedComponents);

            if (similarity.score >= 40) {
              matchType = "exact";
            }
          }
        }

        matches.push({
          deviceId: device.id,
          serialNumber: device.serial_number,
          deviceName: device.device_name,
          matchScore: Math.min(100, matchScore),
          matchType,
          matchedComponents,
        });
      }

      // Also search for similar fingerprints if fingerprint data provided
      if (fingerprintData && matches.length === 0) {
        const allFingerprints = await verificationDB.queryAll<{
          device_id: number;
          serial_number: string;
          device_name: string;
          sensor_patterns: any;
          cpu_gpu_id?: string;
          mac_addresses: string[];
        }>`
          SELECT df.device_id, d.serial_number, d.device_name,
                 df.sensor_patterns, df.cpu_gpu_id, df.mac_addresses
          FROM device_fingerprints df
          JOIN devices d ON df.device_id = d.id
        `;

        for (const storedFingerprint of allFingerprints) {
          const similarity = calculateFingerprintSimilarity(
            fingerprintData,
            {
              sensorPatterns: storedFingerprint.sensor_patterns,
              cpuGpuId: storedFingerprint.cpu_gpu_id,
              macAddresses: storedFingerprint.mac_addresses,
            }
          );

          if (similarity.score >= 30) { // Threshold for partial match
            matches.push({
              deviceId: storedFingerprint.device_id,
              serialNumber: storedFingerprint.serial_number,
              deviceName: storedFingerprint.device_name,
              matchScore: similarity.score,
              matchType: similarity.score >= 70 ? "exact" : "partial",
              matchedComponents: similarity.matchedComponents,
            });
          }
        }
      }
    }

    // Sort matches by score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Determine verification result
    let verificationResult: "verified" | "suspicious" | "not_found";
    const primaryMatch = matches[0];

    if (!primaryMatch) {
      verificationResult = "not_found";
    } else if (primaryMatch.matchScore >= 80) {
      verificationResult = "verified";
    } else if (primaryMatch.matchScore >= 50) {
      verificationResult = "suspicious";
    } else {
      verificationResult = "not_found";
    }

    return {
      matches: matches.slice(0, 5), // Return top 5 matches
      primaryMatch,
      verificationResult,
    };
  }
);

function calculateFingerprintSimilarity(
  provided: DeviceFingerprintData,
  stored: DeviceFingerprintData
): { score: number; matchedComponents: string[] } {
  let score = 0;
  const matchedComponents: string[] = [];

  // Compare sensor patterns
  if (provided.sensorPatterns && stored.sensorPatterns) {
    const sensorSimilarity = compareSensorPatterns(
      provided.sensorPatterns,
      stored.sensorPatterns
    );
    if (sensorSimilarity > 0.8) {
      score += 30;
      matchedComponents.push("sensor_patterns");
    } else if (sensorSimilarity > 0.6) {
      score += 15;
      matchedComponents.push("sensor_patterns_partial");
    }
  }

  // Compare CPU/GPU ID
  if (provided.cpuGpuId && stored.cpuGpuId) {
    if (provided.cpuGpuId === stored.cpuGpuId) {
      score += 25;
      matchedComponents.push("cpu_gpu_id");
    }
  }

  // Compare MAC addresses
  if (provided.macAddresses && stored.macAddresses) {
    const commonMacs = provided.macAddresses.filter(mac =>
      stored.macAddresses?.includes(mac)
    );
    if (commonMacs.length > 0) {
      score += Math.min(20, commonMacs.length * 10);
      matchedComponents.push("mac_addresses");
    }
  }

  return { score, matchedComponents };
}

function compareSensorPatterns(
  provided: any,
  stored: any
): number {
  // Simplified sensor pattern comparison
  // In a real implementation, use more sophisticated signal processing
  
  let totalSimilarity = 0;
  let sensorCount = 0;

  const sensorTypes = ['accelerometer', 'gyroscope', 'magnetometer'];
  
  for (const sensorType of sensorTypes) {
    if (provided[sensorType] && stored[sensorType]) {
      const similarity = calculateArraySimilarity(
        provided[sensorType],
        stored[sensorType]
      );
      totalSimilarity += similarity;
      sensorCount++;
    }
  }

  return sensorCount > 0 ? totalSimilarity / sensorCount : 0;
}

function calculateArraySimilarity(arr1: number[], arr2: number[]): number {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) {
    return 0;
  }

  let similarity = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = Math.abs(arr1[i] - arr2[i]);
    const maxVal = Math.max(Math.abs(arr1[i]), Math.abs(arr2[i]), 1);
    similarity += 1 - (diff / maxVal);
  }

  return similarity / arr1.length;
}
