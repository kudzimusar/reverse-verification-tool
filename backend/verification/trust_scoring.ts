import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface TrustScoreComponents {
  ownershipContinuity: number;
  historyCompleteness: number;
  repairHistory: number;
  disputePenalty: number;
}

export interface TrustScoreResult {
  deviceId: number;
  score: number;
  riskCategory: "low" | "medium" | "high";
  components: TrustScoreComponents;
  lastCalculated: Date;
}

export interface CalculateTrustScoreRequest {
  deviceId: number;
}

export interface CalculateTrustScoreResponse {
  trustScore: TrustScoreResult;
  previousScore?: number;
  scoreChange?: number;
}

// Calculates or recalculates the trust score for a device.
export const calculateTrustScore = api<CalculateTrustScoreRequest, CalculateTrustScoreResponse>(
  { expose: true, method: "POST", path: "/trust-score/calculate" },
  async (req) => {
    const { deviceId } = req;

    // Get device info
    const device = await verificationDB.queryRow<{
      id: number;
      current_trust_score?: number;
    }>`
      SELECT id, current_trust_score FROM devices WHERE id = ${deviceId}
    `;

    if (!device) {
      throw new Error("Device not found");
    }

    const previousScore = device.current_trust_score;

    // Calculate ownership continuity score (0-30 points)
    const ownershipData = await verificationDB.queryAll<{
      transfer_date: Date;
      is_current_owner: boolean;
    }>`
      SELECT transfer_date, is_current_owner 
      FROM ownership_history 
      WHERE device_id = ${deviceId} 
      ORDER BY transfer_date DESC
    `;

    let ownershipContinuity = 0;
    if (ownershipData.length > 0) {
      const currentOwner = ownershipData.find(o => o.is_current_owner);
      if (currentOwner) {
        const daysSinceLastTransfer = Math.floor(
          (Date.now() - new Date(currentOwner.transfer_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        // More points for longer stable ownership, max 30 points
        ownershipContinuity = Math.min(30, Math.floor(daysSinceLastTransfer / 30));
      }
      // Penalty for frequent ownership changes
      if (ownershipData.length > 5) {
        ownershipContinuity -= (ownershipData.length - 5) * 2;
      }
    }
    ownershipContinuity = Math.max(0, ownershipContinuity);

    // Calculate history completeness score (0-25 points)
    const eventsData = await verificationDB.queryAll<{
      event_type: string;
      verified: boolean;
    }>`
      SELECT event_type, verified 
      FROM device_events 
      WHERE device_id = ${deviceId}
    `;

    let historyCompleteness = 0;
    const requiredEvents = ['registration', 'purchase'];
    const verifiedEvents = eventsData.filter(e => e.verified);
    
    // Base points for having required events
    requiredEvents.forEach(eventType => {
      if (verifiedEvents.some(e => e.event_type === eventType)) {
        historyCompleteness += 8;
      }
    });
    
    // Additional points for other verified events
    const additionalVerifiedEvents = verifiedEvents.filter(
      e => !requiredEvents.includes(e.event_type)
    ).length;
    historyCompleteness += Math.min(9, additionalVerifiedEvents * 3);

    // Calculate repair history score (0-20 points)
    const repairEvents = eventsData.filter(e => e.event_type === 'repair');
    let repairHistory = 10; // Start with neutral score
    
    repairEvents.forEach(repair => {
      if (repair.verified) {
        repairHistory += 2; // Verified repairs increase trust
      } else {
        repairHistory -= 3; // Unverified repairs decrease trust
      }
    });
    repairHistory = Math.max(0, Math.min(20, repairHistory));

    // Calculate dispute penalty (0 to -25 points)
    const reportsData = await verificationDB.queryAll<{
      report_type: string;
      status: string;
      created_at: Date;
    }>`
      SELECT report_type, status, created_at 
      FROM reports 
      WHERE device_id = ${deviceId}
    `;

    let disputePenalty = 0;
    reportsData.forEach(report => {
      const daysSinceReport = Math.floor(
        (Date.now() - new Date(report.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      let penalty = 0;
      switch (report.report_type) {
        case 'stolen':
          penalty = report.status === 'verified' ? -25 : -15;
          break;
        case 'fraud':
          penalty = report.status === 'verified' ? -20 : -10;
          break;
        case 'tampered':
          penalty = report.status === 'verified' ? -15 : -8;
          break;
        default:
          penalty = report.status === 'verified' ? -10 : -5;
      }
      
      // Reduce penalty over time (but not completely)
      if (daysSinceReport > 365) {
        penalty = Math.floor(penalty * 0.5);
      } else if (daysSinceReport > 180) {
        penalty = Math.floor(penalty * 0.7);
      }
      
      disputePenalty += penalty;
    });

    // Calculate final score
    const finalScore = Math.max(0, Math.min(100, 
      ownershipContinuity + historyCompleteness + repairHistory + disputePenalty + 25 // Base score of 25
    ));

    // Determine risk category
    let riskCategory: "low" | "medium" | "high";
    if (finalScore >= 80) {
      riskCategory = "low";
    } else if (finalScore >= 50) {
      riskCategory = "medium";
    } else {
      riskCategory = "high";
    }

    // Store the trust score
    await verificationDB.exec`
      INSERT INTO trust_scores (
        device_id, score, risk_category, 
        ownership_continuity_score, history_completeness_score, 
        repair_history_score, dispute_penalty, calculated_at
      ) VALUES (
        ${deviceId}, ${finalScore}, ${riskCategory},
        ${ownershipContinuity}, ${historyCompleteness},
        ${repairHistory}, ${disputePenalty}, CURRENT_TIMESTAMP
      )
      ON CONFLICT (device_id) DO UPDATE SET
        score = EXCLUDED.score,
        risk_category = EXCLUDED.risk_category,
        ownership_continuity_score = EXCLUDED.ownership_continuity_score,
        history_completeness_score = EXCLUDED.history_completeness_score,
        repair_history_score = EXCLUDED.repair_history_score,
        dispute_penalty = EXCLUDED.dispute_penalty,
        calculated_at = EXCLUDED.calculated_at
    `;

    // Update device table
    await verificationDB.exec`
      UPDATE devices 
      SET current_trust_score = ${finalScore}, risk_category = ${riskCategory}
      WHERE id = ${deviceId}
    `;

    const components: TrustScoreComponents = {
      ownershipContinuity,
      historyCompleteness,
      repairHistory,
      disputePenalty,
    };

    const trustScore: TrustScoreResult = {
      deviceId,
      score: finalScore,
      riskCategory,
      components,
      lastCalculated: new Date(),
    };

    const response: CalculateTrustScoreResponse = {
      trustScore,
    };

    if (previousScore !== null && previousScore !== undefined) {
      response.previousScore = previousScore;
      response.scoreChange = finalScore - previousScore;
    }

    return response;
  }
);

export interface GetTrustScoreRequest {
  deviceId: number;
}

export interface GetTrustScoreResponse {
  trustScore: TrustScoreResult | null;
}

// Gets the current trust score for a device.
export const getTrustScore = api<GetTrustScoreRequest, GetTrustScoreResponse>(
  { expose: true, method: "GET", path: "/trust-score/:deviceId" },
  async (req) => {
    const { deviceId } = req;

    const trustScoreData = await verificationDB.queryRow<{
      device_id: number;
      score: number;
      risk_category: string;
      ownership_continuity_score: number;
      history_completeness_score: number;
      repair_history_score: number;
      dispute_penalty: number;
      calculated_at: Date;
    }>`
      SELECT device_id, score, risk_category, ownership_continuity_score,
             history_completeness_score, repair_history_score, dispute_penalty,
             calculated_at
      FROM trust_scores 
      WHERE device_id = ${deviceId}
    `;

    if (!trustScoreData) {
      return { trustScore: null };
    }

    const trustScore: TrustScoreResult = {
      deviceId: trustScoreData.device_id,
      score: trustScoreData.score,
      riskCategory: trustScoreData.risk_category as "low" | "medium" | "high",
      components: {
        ownershipContinuity: trustScoreData.ownership_continuity_score,
        historyCompleteness: trustScoreData.history_completeness_score,
        repairHistory: trustScoreData.repair_history_score,
        disputePenalty: trustScoreData.dispute_penalty,
      },
      lastCalculated: trustScoreData.calculated_at,
    };

    return { trustScore };
  }
);
