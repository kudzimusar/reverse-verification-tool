interface DeviceCacheEntry {
  id: string;
  imei: string;
  status: string;
  manufacturer?: string;
  model?: string;
  trustScore: number;
  verificationCount: number;
  reportCount: number;
  updatedAt: Date;
}

interface TrustScoreCacheEntry {
  deviceId: string;
  score: number;
  riskCategory: string;
  calculatedAt: Date;
}

interface SearchResultsCacheEntry {
  query: string;
  results: any[];
  timestamp: Date;
}

const deviceCacheStore = new Map<string, { data: DeviceCacheEntry; expires: number }>();
const trustScoreCacheStore = new Map<string, { data: TrustScoreCacheEntry; expires: number }>();
const searchCacheStore = new Map<string, { data: SearchResultsCacheEntry; expires: number }>();
const statsCacheStore = new Map<string, { data: any; expires: number }>();

function isExpired(expires: number): boolean {
  return Date.now() > expires;
}

export async function getCachedDevice(deviceId: string): Promise<DeviceCacheEntry | undefined> {
  const cached = deviceCacheStore.get(deviceId);
  if (cached && !isExpired(cached.expires)) {
    return cached.data;
  }
  if (cached) {
    deviceCacheStore.delete(deviceId);
  }
  return undefined;
}

export async function setCachedDevice(deviceId: string, data: DeviceCacheEntry): Promise<void> {
  deviceCacheStore.set(deviceId, {
    data,
    expires: Date.now() + 300000,
  });
}

export async function invalidateDeviceCache(deviceId: string): Promise<void> {
  deviceCacheStore.delete(deviceId);
}

export async function getCachedTrustScore(deviceId: string): Promise<TrustScoreCacheEntry | undefined> {
  const cached = trustScoreCacheStore.get(deviceId);
  if (cached && !isExpired(cached.expires)) {
    return cached.data;
  }
  if (cached) {
    trustScoreCacheStore.delete(deviceId);
  }
  return undefined;
}

export async function setCachedTrustScore(deviceId: string, data: TrustScoreCacheEntry): Promise<void> {
  trustScoreCacheStore.set(deviceId, {
    data,
    expires: Date.now() + 600000,
  });
}

export async function getCachedSearchResults(query: string): Promise<any[] | undefined> {
  const cached = searchCacheStore.get(query);
  if (cached && !isExpired(cached.expires)) {
    return cached.data.results;
  }
  if (cached) {
    searchCacheStore.delete(query);
  }
  return undefined;
}

export async function setCachedSearchResults(query: string, results: any[]): Promise<void> {
  searchCacheStore.set(query, {
    data: {
      query,
      results,
      timestamp: new Date(),
    },
    expires: Date.now() + 180000,
  });
}
