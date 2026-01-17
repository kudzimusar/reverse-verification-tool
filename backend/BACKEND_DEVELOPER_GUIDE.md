# Backend Developer Guide

**Location:** `/backend/verification/`  
**Framework:** Encore.dev  
**Language:** TypeScript  
**Runtime:** Node.js 18+

---

## Architecture Overview

### Service Structure
Each file in `/backend/verification/` represents an **Encore Service** - a collection of related API endpoints.

```
backend/verification/
├── verify.ts                    # Core device verification
├── device_fingerprinting.ts     # Device identification
├── trust_scoring.ts             # Trust score calculation
├── badge_lifecycle.ts           # Badge management
├── blockchain.ts                # Blockchain integration
├── zkp_verification.ts          # Zero-knowledge proofs
├── marketplace_sdk.ts           # Marketplace integration
├── partner_api.ts               # Partner endpoints
├── seller_dashboard.ts          # Seller features
├── device_watchers.ts           # Device monitoring
├── device_comparison.ts         # Device comparison
├── flag_device.ts               # Device flagging
├── generate_badge.ts            # Badge generation
├── generate_link.ts             # Link generation
├── get_device.ts                # Device retrieval
├── lifecycle.ts                 # Lifecycle management
├── report.ts                    # Reporting
├── search.ts                    # Search functionality
├── seed.ts                      # Data seeding
└── encore.service.ts            # Service definition
```

### Key Rule
**Each service file must export Encore endpoints using the `@api()` decorator**

---

## Creating a New Endpoint

### Template
```typescript
// File: backend/verification/my_feature.ts
import { api } from "encore.dev/api";

// Define request type
interface MyFeatureRequest {
  deviceId: string;
  data: string;
}

// Define response type
interface MyFeatureResponse {
  success: boolean;
  result: string;
}

// Export endpoint
export const myFeature = api(
  { method: "POST", path: "/verify/my-feature" },
  async (req: MyFeatureRequest): Promise<MyFeatureResponse> => {
    // Implementation
    return {
      success: true,
      result: "Feature executed",
    };
  }
);
```

### Endpoint Naming Convention
- **Method:** GET (retrieve), POST (create/verify), PUT (update), DELETE (remove)
- **Path:** `/verify/{feature-name}` (lowercase, hyphens)
- **Function name:** camelCase

### Example Endpoints
```typescript
// GET - Retrieve data
export const getDevice = api(
  { method: "GET", path: "/verify/device/:id" },
  async (req: { id: string }): Promise<Device> => {
    // ...
  }
);

// POST - Create/verify
export const verifyDevice = api(
  { method: "POST", path: "/verify/device" },
  async (req: VerifyRequest): Promise<VerifyResponse> => {
    // ...
  }
);

// PUT - Update
export const updateDevice = api(
  { method: "PUT", path: "/verify/device/:id" },
  async (req: UpdateRequest): Promise<Device> => {
    // ...
  }
);

// DELETE - Remove
export const deleteDevice = api(
  { method: "DELETE", path: "/verify/device/:id" },
  async (req: { id: string }): Promise<{ success: boolean }> => {
    // ...
  }
);
```

---

## Database Access

### Using Drizzle ORM
```typescript
import { db } from "./db";

// Query
const device = await db.query.devices.findFirst({
  where: (devices, { eq }) => eq(devices.serialNumber, serialNumber),
});

// Insert
await db.insert(devices).values({
  serialNumber: "ABC123",
  manufacturer: "Apple",
  model: "iPhone 14",
});

// Update
await db.update(devices)
  .set({ trustScore: 95 })
  .where(eq(devices.id, deviceId));

// Delete
await db.delete(devices)
  .where(eq(devices.id, deviceId));
```

### Database Schema
**File:** `backend/verification/db.ts`

```typescript
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").unique(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  trustScore: integer("trust_score"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## Error Handling

### Proper Error Responses
```typescript
// ✅ Good - Returns 400 with error message
if (!serialNumber) {
  throw new Error("Serial number is required");
}

// ✅ Good - Returns 404
if (!device) {
  throw new Error("Device not found");
}

// ✅ Good - Returns 401
if (!isAuthorized) {
  throw new Error("Unauthorized");
}

// ❌ Bad - Returns 200 (wrong status code)
if (!device) {
  return { error: "Device not found", success: false };
}
```

### HTTP Status Codes
- **200:** Success
- **400:** Bad request (validation error)
- **401:** Unauthorized
- **403:** Forbidden
- **404:** Not found
- **500:** Server error

---

## Authentication & Authorization

### Using Encore Auth
```typescript
import { api } from "encore.dev/api";

export const protectedEndpoint = api(
  { method: "POST", path: "/verify/protected", auth: true },
  async (req: Request, auth: any): Promise<Response> => {
    // auth contains user information
    console.log("User ID:", auth.uid);
    // ...
  }
);
```

### Checking Permissions
```typescript
function requireRole(auth: any, role: string) {
  if (auth.role !== role) {
    throw new Error("Insufficient permissions");
  }
}

export const adminOnly = api(
  { method: "POST", path: "/verify/admin", auth: true },
  async (req: Request, auth: any): Promise<Response> => {
    requireRole(auth, "admin");
    // ...
  }
);
```

---

## Caching

### Using Redis
```typescript
import { cache } from "./cache";

export const getCachedDevice = api(
  { method: "GET", path: "/verify/device/:id" },
  async (req: { id: string }): Promise<Device> => {
    // Try cache first
    const cached = await cache.get(`device:${req.id}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const device = await db.query.devices.findFirst({
      where: (devices, { eq }) => eq(devices.id, req.id),
    });

    // Cache for 1 hour
    await cache.set(`device:${req.id}`, JSON.stringify(device), 3600);

    return device;
  }
);
```

---

## Blockchain Integration

### Recording Verification on Blockchain
```typescript
import { recordOnBlockchain } from "./blockchain";

export const verifyWithBlockchain = api(
  { method: "POST", path: "/verify/blockchain" },
  async (req: VerifyRequest): Promise<VerifyResponse> => {
    // Perform verification
    const result = await performVerification(req);

    // Record on blockchain
    const txHash = await recordOnBlockchain({
      deviceId: req.deviceId,
      verified: result.verified,
      timestamp: new Date(),
    });

    return {
      ...result,
      blockchainTx: txHash,
    };
  }
);
```

---

## Zero-Knowledge Proofs

### Generating ZKP
```typescript
import { generateZKProof, verifyZKProof } from "./zkp_verification";

export const createZKProof = api(
  { method: "POST", path: "/verify/zkp/generate" },
  async (req: ZKProofRequest): Promise<ZKProofResponse> => {
    const proof = await generateZKProof({
      deviceId: req.deviceId,
      claim: req.claim,
    });

    return { proof };
  }
);

export const validateZKProof = api(
  { method: "POST", path: "/verify/zkp/verify" },
  async (req: ZKVerifyRequest): Promise<ZKVerifyResponse> => {
    const isValid = await verifyZKProof({
      proof: req.proof,
      claim: req.claim,
    });

    return { valid: isValid };
  }
);
```

---

## Testing

### Unit Tests
```typescript
// File: backend/verification/__tests__/verify.test.ts
import { describe, it, expect } from "bun:test";
import { verifyDevice } from "../verify";

describe("Device Verification", () => {
  it("should verify a valid device", async () => {
    const result = await verifyDevice({
      serialNumber: "ABC123",
      manufacturer: "Apple",
    });

    expect(result.verified).toBe(true);
  });

  it("should reject invalid serial number", async () => {
    expect(() =>
      verifyDevice({
        serialNumber: "",
        manufacturer: "Apple",
      })
    ).toThrow();
  });
});
```

### Running Tests
```bash
bun run test
bun run test:watch
```

---

## Logging & Monitoring

### Logging
```typescript
// Simple logging
console.log("Device verified:", deviceId);
console.error("Verification failed:", error);

// Structured logging (recommended)
import { logger } from "encore.dev/logging";

logger.info("device_verified", {
  deviceId,
  trustScore,
  timestamp: new Date(),
});

logger.error("verification_failed", {
  deviceId,
  error: error.message,
});
```

### Monitoring
- **Encore Dashboard:** https://app.encore.cloud/reverse-verification-tool-i452
- **Logs:** Dashboard → Logs
- **Metrics:** Dashboard → Metrics
- **Errors:** Dashboard → Errors

---

## Performance Best Practices

### 1. Use Indexes
```typescript
// Add indexes to frequently queried columns
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").unique().index(),
  manufacturer: text("manufacturer").index(),
  // ...
});
```

### 2. Batch Operations
```typescript
// ✅ Good - Batch insert
await db.insert(devices).values([
  { serialNumber: "ABC123", ... },
  { serialNumber: "ABC124", ... },
  { serialNumber: "ABC125", ... },
]);

// ❌ Bad - Individual inserts
for (const device of devices) {
  await db.insert(devices).values(device);
}
```

### 3. Pagination
```typescript
export const listDevices = api(
  { method: "GET", path: "/verify/devices" },
  async (req: { page: number; limit: number }): Promise<DeviceList> => {
    const offset = (req.page - 1) * req.limit;

    const devices = await db.query.devices
      .findMany({
        limit: req.limit,
        offset: offset,
      });

    return { devices, page: req.page, limit: req.limit };
  }
);
```

### 4. Caching
```typescript
// Cache expensive operations
const result = await cache.getOrSet(
  `expensive_operation:${key}`,
  async () => {
    // Expensive operation
    return await performExpensiveOperation();
  },
  3600 // 1 hour TTL
);
```

---

## Common Patterns

### Verification Flow
```typescript
export const verify = api(
  { method: "POST", path: "/verify/device" },
  async (req: VerifyRequest): Promise<VerifyResponse> => {
    // 1. Validate input
    if (!req.serialNumber) {
      throw new Error("Serial number required");
    }

    // 2. Check cache
    const cached = await cache.get(`device:${req.serialNumber}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // 3. Get device from database
    const device = await db.query.devices.findFirst({
      where: (devices, { eq }) => eq(devices.serialNumber, req.serialNumber),
    });

    if (!device) {
      throw new Error("Device not found");
    }

    // 4. Perform verification logic
    const verified = await performVerification(device);

    // 5. Calculate trust score
    const trustScore = await calculateTrustScore(device, verified);

    // 6. Record on blockchain (if needed)
    if (req.recordOnBlockchain) {
      await recordOnBlockchain({ deviceId: device.id, verified, trustScore });
    }

    // 7. Cache result
    const result = { verified, trustScore, device };
    await cache.set(`device:${req.serialNumber}`, JSON.stringify(result), 3600);

    // 8. Return response
    return result;
  }
);
```

---

## Debugging

### Local Development
```bash
# Start backend with verbose logging
encore run --log-level debug

# Check logs
tail -f ~/.encore/logs/app.log
```

### Production Debugging
1. Check Encore dashboard logs
2. Check error tracking (Sentry if configured)
3. Check database logs
4. Check application logs

---

## Deployment

### Before Pushing
```bash
# Type check
bun run check

# Lint
bun run lint

# Test
bun run test

# Build
bun run build
```

### After Pushing
1. GitHub Actions runs automatically
2. Encore deploys automatically
3. Check Encore dashboard for deployment status
4. Test on staging: https://reverse-verification-tool-i452-staging.encr.app

---

## Resources

- **Encore Documentation:** https://encore.dev/docs
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Drizzle ORM:** https://orm.drizzle.team/
- **Project Architecture:** See `PROJECT_ARCHITECTURE_REPORT.md`
- **Team Guidelines:** See `KNOWLEDGE_RULES.md`

---

**Last Updated:** January 18, 2026  
**Version:** 1.0
