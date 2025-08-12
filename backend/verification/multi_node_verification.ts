import { api } from "encore.dev/api";
import { verificationDB } from "./db";

export interface VerificationNode {
  id: number;
  nodeName: string;
  nodeType: string;
  endpointUrl: string;
  isActive: boolean;
  priority: number;
}

export interface NodeResponse {
  nodeId: number;
  nodeName: string;
  status: "success" | "failure" | "timeout";
  responseTime: number;
  data?: any;
  error?: string;
}

export interface MultiNodeVerificationRequest {
  identifier: string;
  identifierType: "serial" | "imei";
  requiredNodes?: number;
}

export interface MultiNodeVerificationResponse {
  requestId: string;
  identifier: string;
  identifierType: "serial" | "imei";
  nodeResponses: NodeResponse[];
  consensus: {
    verified: boolean;
    confidence: number;
    agreementCount: number;
    totalNodes: number;
  };
  device?: {
    id: number;
    serialNumber: string;
    deviceName: string;
    status: string;
  };
}

// Verifies a device across multiple independent nodes for enhanced reliability.
export const multiNodeVerify = api<MultiNodeVerificationRequest, MultiNodeVerificationResponse>(
  { expose: true, method: "POST", path: "/verify/multi-node" },
  async (req) => {
    const { identifier, identifierType, requiredNodes = 3 } = req;
    const requestId = `mnv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get active verification nodes
    const nodes = await verificationDB.queryAll<{
      id: number;
      node_name: string;
      node_type: string;
      endpoint_url: string;
      is_active: boolean;
      priority: number;
    }>`
      SELECT id, node_name, node_type, endpoint_url, is_active, priority
      FROM verification_nodes 
      WHERE is_active = true 
      ORDER BY priority ASC
    `;

    if (nodes.length === 0) {
      throw new Error("No active verification nodes available");
    }

    const nodeResponses: NodeResponse[] = [];
    const verificationPromises = nodes.map(async (node) => {
      const startTime = Date.now();
      
      try {
        let response;
        let responseTime;
        
        if (node.node_type === 'stolen') {
          // Query our own database for STOLEN node
          const device = await verificationDB.queryRow<{
            id: number;
            serial_number: string;
            device_name: string;
            status: string;
          }>`
            SELECT id, serial_number, device_name, status
            FROM devices 
            WHERE ${identifierType === 'serial' ? 'serial_number' : 'imei'} = ${identifier}
          `;
          
          responseTime = Date.now() - startTime;
          
          if (device) {
            response = {
              found: true,
              device: {
                id: device.id,
                serialNumber: device.serial_number,
                deviceName: device.device_name,
                status: device.status,
              }
            };
          } else {
            response = { found: false };
          }
        } else {
          // For external nodes, simulate API call (in real implementation, make actual HTTP requests)
          await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // Simulate network delay
          responseTime = Date.now() - startTime;
          
          // Simulate different response patterns based on node type
          const simulatedFound = Math.random() > 0.3; // 70% chance of finding device
          
          if (simulatedFound) {
            response = {
              found: true,
              device: {
                identifier,
                status: Math.random() > 0.8 ? 'flagged' : 'clean',
                source: node.node_type,
              }
            };
          } else {
            response = { found: false };
          }
        }

        const nodeResponse: NodeResponse = {
          nodeId: node.id,
          nodeName: node.node_name,
          status: "success",
          responseTime,
          data: response,
        };

        // Store audit record
        await verificationDB.exec`
          INSERT INTO verification_audit (
            device_id, verification_request_id, node_id, 
            node_response, response_status, response_time_ms
          ) VALUES (
            ${response.device?.id || null}, ${requestId}, ${node.id},
            ${JSON.stringify(response)}, 'success', ${responseTime}
          )
        `;

        return nodeResponse;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const nodeResponse: NodeResponse = {
          nodeId: node.id,
          nodeName: node.node_name,
          status: responseTime > 5000 ? "timeout" : "failure",
          responseTime,
          error: error instanceof Error ? error.message : "Unknown error",
        };

        // Store audit record for failure
        await verificationDB.exec`
          INSERT INTO verification_audit (
            device_id, verification_request_id, node_id, 
            node_response, response_status, response_time_ms
          ) VALUES (
            ${null}, ${requestId}, ${node.id},
            ${JSON.stringify({ error: nodeResponse.error })}, 
            ${nodeResponse.status}, ${responseTime}
          )
        `;

        return nodeResponse;
      }
    });

    // Wait for all node responses
    const responses = await Promise.all(verificationPromises);
    nodeResponses.push(...responses);

    // Calculate consensus
    const successfulResponses = nodeResponses.filter(r => r.status === "success");
    const foundResponses = successfulResponses.filter(r => r.data?.found === true);
    const agreementCount = foundResponses.length;
    const totalNodes = successfulResponses.length;
    
    const verified = agreementCount >= Math.min(requiredNodes, Math.ceil(totalNodes / 2));
    const confidence = totalNodes > 0 ? (agreementCount / totalNodes) * 100 : 0;

    // Get device info if verified
    let device;
    if (verified && foundResponses.length > 0) {
      const stolenNodeResponse = foundResponses.find(r => 
        nodeResponses.find(nr => nr.nodeId === r.nodeId)?.nodeName.includes('STOLEN')
      );
      
      if (stolenNodeResponse?.data?.device) {
        device = stolenNodeResponse.data.device;
      }
    }

    return {
      requestId,
      identifier,
      identifierType,
      nodeResponses,
      consensus: {
        verified,
        confidence: Math.round(confidence),
        agreementCount,
        totalNodes,
      },
      device,
    };
  }
);

export interface GetVerificationAuditRequest {
  requestId?: string;
  deviceId?: number;
  limit?: number;
}

export interface GetVerificationAuditResponse {
  audits: Array<{
    id: number;
    requestId: string;
    deviceId?: number;
    nodeName: string;
    nodeType: string;
    response: any;
    status: string;
    responseTime: number;
    timestamp: Date;
  }>;
  total: number;
}

// Gets verification audit logs for transparency.
export const getVerificationAudit = api<GetVerificationAuditRequest, GetVerificationAuditResponse>(
  { expose: true, method: "GET", path: "/verify/audit" },
  async (req) => {
    const { requestId, deviceId, limit = 50 } = req;

    let whereConditions: string[] = [];
    const params: any[] = [];
    
    if (requestId) {
      whereConditions.push(`va.verification_request_id = $${params.length + 1}`);
      params.push(requestId);
    }
    
    if (deviceId) {
      whereConditions.push(`va.device_id = $${params.length + 1}`);
      params.push(deviceId);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const audits = await verificationDB.queryAll<{
      id: number;
      verification_request_id: string;
      device_id?: number;
      node_name: string;
      node_type: string;
      node_response: any;
      response_status: string;
      response_time_ms: number;
      created_at: Date;
    }>`
      SELECT va.id, va.verification_request_id, va.device_id,
             vn.node_name, vn.node_type, va.node_response,
             va.response_status, va.response_time_ms, va.created_at
      FROM verification_audit va
      JOIN verification_nodes vn ON va.node_id = vn.id
      ${whereClause}
      ORDER BY va.created_at DESC
      LIMIT ${limit}
    `;

    const totalResult = await verificationDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM verification_audit va
      ${whereClause}
    `;

    return {
      audits: audits.map(audit => ({
        id: audit.id,
        requestId: audit.verification_request_id,
        deviceId: audit.device_id,
        nodeName: audit.node_name,
        nodeType: audit.node_type,
        response: audit.node_response,
        status: audit.response_status,
        responseTime: audit.response_time_ms,
        timestamp: audit.created_at,
      })),
      total: totalResult?.count || 0,
    };
  }
);
