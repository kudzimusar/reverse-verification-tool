import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { verificationDB } from "./db";

export interface AdvancedSearchRequest {
  query?: Query<string>;
  status?: Query<string[]>;
  manufacturer?: Query<string[]>;
  model?: Query<string[]>;
  minTrustScore?: Query<number>;
  maxTrustScore?: Query<number>;
  minVerificationCount?: Query<number>;
  hasReports?: Query<boolean>;
  isWatched?: Query<boolean>;
  createdAfter?: Query<string>;
  createdBefore?: Query<string>;
  verifiedAfter?: Query<string>;
  sortBy?: Query<string>;
  sortOrder?: Query<"asc" | "desc">;
  page?: Query<number>;
  limit?: Query<number>;
}

export interface AdvancedSearchResult {
  id: string;
  imei: string;
  status: string;
  manufacturer?: string;
  model?: string;
  trustScore: number;
  verificationCount: number;
  reportCount: number;
  watcherCount: number;
  lastVerified?: Date;
  flaggedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdvancedSearchResponse {
  devices: AdvancedSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    statuses: Record<string, number>;
    manufacturers: Record<string, number>;
    models: Record<string, number>;
    trustScoreRanges: {
      low: number;
      medium: number;
      high: number;
    };
  };
}

export const advancedSearch = api(
  { method: "GET", path: "/devices/search/advanced", expose: true },
  async (req: AdvancedSearchRequest): Promise<AdvancedSearchResponse> => {
    const page = req.page || 1;
    const limit = Math.min(req.limit || 20, 100);
    const offset = (page - 1) * limit;
    const sortBy = req.sortBy || "updated_at";
    const sortOrder = req.sortOrder || "desc";

    const validSortFields = ["trust_score", "verification_count", "report_count", "created_at", "updated_at"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "updated_at";

    let conditions: string[] = ["1=1"];
    const params: any[] = [];

    if (req.query) {
      conditions.push(`(d.imei ILIKE $${params.length + 1} OR d.manufacturer ILIKE $${params.length + 1} OR d.model ILIKE $${params.length + 1})`);
      params.push(`%${req.query}%`);
    }

    if (req.status && req.status.length > 0) {
      conditions.push(`d.status = ANY($${params.length + 1})`);
      params.push(req.status);
    }

    if (req.manufacturer && req.manufacturer.length > 0) {
      conditions.push(`d.manufacturer = ANY($${params.length + 1})`);
      params.push(req.manufacturer);
    }

    if (req.model && req.model.length > 0) {
      conditions.push(`d.model = ANY($${params.length + 1})`);
      params.push(req.model);
    }

    if (req.minTrustScore !== undefined) {
      conditions.push(`d.trust_score >= $${params.length + 1}`);
      params.push(req.minTrustScore);
    }

    if (req.maxTrustScore !== undefined) {
      conditions.push(`d.trust_score <= $${params.length + 1}`);
      params.push(req.maxTrustScore);
    }

    if (req.minVerificationCount !== undefined) {
      conditions.push(`d.verification_count >= $${params.length + 1}`);
      params.push(req.minVerificationCount);
    }

    if (req.hasReports !== undefined) {
      if (req.hasReports) {
        conditions.push(`d.report_count > 0`);
      } else {
        conditions.push(`d.report_count = 0`);
      }
    }

    if (req.isWatched !== undefined) {
      if (req.isWatched) {
        conditions.push(`EXISTS (SELECT 1 FROM device_watchers w WHERE w.device_id = d.id)`);
      } else {
        conditions.push(`NOT EXISTS (SELECT 1 FROM device_watchers w WHERE w.device_id = d.id)`);
      }
    }

    if (req.createdAfter) {
      conditions.push(`d.created_at >= $${params.length + 1}`);
      params.push(new Date(req.createdAfter));
    }

    if (req.createdBefore) {
      conditions.push(`d.created_at <= $${params.length + 1}`);
      params.push(new Date(req.createdBefore));
    }

    if (req.verifiedAfter) {
      conditions.push(`d.updated_at >= $${params.length + 1}`);
      params.push(new Date(req.verifiedAfter));
    }

    const whereClause = conditions.join(" AND ");

    const query = `
      SELECT 
        d.id,
        d.imei,
        d.status,
        d.manufacturer,
        d.model,
        d.trust_score,
        d.verification_count,
        d.report_count,
        d.flagged_reason,
        d.created_at,
        d.updated_at,
        COUNT(DISTINCT w.id) as watcher_count,
        MAX(vl.created_at) as last_verified
      FROM devices d
      LEFT JOIN device_watchers w ON d.id = w.device_id
      LEFT JOIN verification_logs vl ON d.id = vl.device_id
      WHERE ${whereClause}
      GROUP BY d.id, d.imei, d.status, d.manufacturer, d.model, d.trust_score, 
               d.verification_count, d.report_count, d.flagged_reason, d.created_at, d.updated_at
      ORDER BY d.${sortField} ${sortOrder.toUpperCase()}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const devices = await verificationDB.query(query, ...params);

    const countQuery = `
      SELECT COUNT(DISTINCT d.id) as total
      FROM devices d
      LEFT JOIN device_watchers w ON d.id = w.device_id
      LEFT JOIN verification_logs vl ON d.id = vl.device_id
      WHERE ${whereClause}
    `;

    const countResult = await verificationDB.queryRow(countQuery, ...params.slice(0, -2));
    const total = parseInt(countResult.total) || 0;

    const facetsQuery = `
      SELECT 
        d.status,
        d.manufacturer,
        d.model,
        d.trust_score
      FROM devices d
      LEFT JOIN device_watchers w ON d.id = w.device_id
      LEFT JOIN verification_logs vl ON d.id = vl.device_id
      WHERE ${whereClause}
    `;

    const facetsData = await verificationDB.query(facetsQuery, ...params.slice(0, -2));

    const statuses: Record<string, number> = {};
    const manufacturers: Record<string, number> = {};
    const models: Record<string, number> = {};
    let low = 0, medium = 0, high = 0;

    for (const row of facetsData) {
      statuses[row.status] = (statuses[row.status] || 0) + 1;
      
      if (row.manufacturer) {
        manufacturers[row.manufacturer] = (manufacturers[row.manufacturer] || 0) + 1;
      }
      
      if (row.model) {
        models[row.model] = (models[row.model] || 0) + 1;
      }

      const score = parseFloat(row.trust_score) || 0;
      if (score < 50) low++;
      else if (score < 80) medium++;
      else high++;
    }

    return {
      devices: devices.map(d => ({
        id: d.id,
        imei: d.imei,
        status: d.status,
        manufacturer: d.manufacturer,
        model: d.model,
        trustScore: parseFloat(d.trust_score) || 0,
        verificationCount: parseInt(d.verification_count) || 0,
        reportCount: parseInt(d.report_count) || 0,
        watcherCount: parseInt(d.watcher_count) || 0,
        lastVerified: d.last_verified,
        flaggedReason: d.flagged_reason,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      })),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      facets: {
        statuses,
        manufacturers,
        models,
        trustScoreRanges: { low, medium, high },
      },
    };
  }
);

export interface SearchSuggestionsRequest {
  query: Query<string>;
  field?: Query<"manufacturer" | "model" | "imei">;
  limit?: Query<number>;
}

export interface SearchSuggestionsResponse {
  suggestions: string[];
}

export const searchSuggestions = api(
  { method: "GET", path: "/devices/search/suggestions", expose: true },
  async (req: SearchSuggestionsRequest): Promise<SearchSuggestionsResponse> => {
    const field = req.field || "manufacturer";
    const limit = Math.min(req.limit || 10, 50);
    const searchTerm = `${req.query}%`;

    let query: string;
    if (field === "manufacturer") {
      query = `SELECT DISTINCT manufacturer FROM devices WHERE manufacturer ILIKE $1 AND manufacturer IS NOT NULL ORDER BY manufacturer LIMIT $2`;
    } else if (field === "model") {
      query = `SELECT DISTINCT model FROM devices WHERE model ILIKE $1 AND model IS NOT NULL ORDER BY model LIMIT $2`;
    } else {
      query = `SELECT DISTINCT imei FROM devices WHERE imei ILIKE $1 ORDER BY imei LIMIT $2`;
    }

    const results = await verificationDB.query(query, searchTerm, limit);
    const suggestions = results.map(r => r[field === "imei" ? "imei" : field === "model" ? "model" : "manufacturer"]);

    return { suggestions };
  }
);

export interface SavedSearchRequest {
  name: string;
  filters: AdvancedSearchRequest;
  userId: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: AdvancedSearchRequest;
  userId: string;
  createdAt: Date;
}

export const saveSearch = api(
  { method: "POST", path: "/devices/search/save", expose: true, auth: true },
  async (req: SavedSearchRequest): Promise<SavedSearch> => {
    const result = await verificationDB.queryRow`
      INSERT INTO saved_searches (name, filters, user_id)
      VALUES (${req.name}, ${JSON.stringify(req.filters)}, ${req.userId})
      RETURNING id, name, filters, user_id, created_at
    `;

    return {
      id: result.id,
      name: result.name,
      filters: result.filters,
      userId: result.user_id,
      createdAt: result.created_at,
    };
  }
);

export const getSavedSearches = api(
  { method: "GET", path: "/devices/search/saved/:userId", expose: true, auth: true },
  async ({ userId }: { userId: string }): Promise<{ searches: SavedSearch[] }> => {
    const searches = await verificationDB.query`
      SELECT id, name, filters, user_id, created_at
      FROM saved_searches
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    return {
      searches: searches.map(s => ({
        id: s.id,
        name: s.name,
        filters: s.filters,
        userId: s.user_id,
        createdAt: s.created_at,
      })),
    };
  }
);
