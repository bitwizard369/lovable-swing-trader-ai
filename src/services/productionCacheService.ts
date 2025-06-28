
interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size
  prefix: string; // Cache key prefix
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class ProductionCacheService {
  private static instance: ProductionCacheService;
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: 300000, // 5 minutes default
      maxSize: 1000, // 1000 entries max
      prefix: 'prod_cache_',
      ...config
    };

    this.startCleanupRoutine();
    this.detectAndClearStaleCache();
    console.log('[Production Cache] 🚀 Initialized with config:', this.config);
  }

  static getInstance(config?: Partial<CacheConfig>): ProductionCacheService {
    if (!ProductionCacheService.instance) {
      ProductionCacheService.instance = new ProductionCacheService(config);
    }
    return ProductionCacheService.instance;
  }

  // Smart cache key generation with version support
  private generateKey(key: string, version?: string): string {
    const appVersion = '1.0.0'; // In production, get from environment
    const versionSuffix = version || appVersion;
    return `${this.config.prefix}${key}_v${versionSuffix}`;
  }

  // Set cache with automatic versioning
  set<T>(key: string, data: T, ttl?: number, version?: string): void {
    const cacheKey = this.generateKey(key, version);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      hits: 0
    };

    // Enforce cache size limit
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastUsed();
    }

    this.cache.set(cacheKey, entry);
    console.log(`[Production Cache] 💾 Cached: ${key} (TTL: ${entry.ttl}ms)`);
  }

  // Get from cache with hit tracking
  get<T>(key: string, version?: string): T | null {
    const cacheKey = this.generateKey(key, version);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      console.log(`[Production Cache] ❌ Cache miss: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      console.log(`[Production Cache] ⏰ Expired: ${key}`);
      return null;
    }

    // Update hit count
    entry.hits++;
    console.log(`[Production Cache] ✅ Cache hit: ${key} (hits: ${entry.hits})`);
    return entry.data;
  }

  // Smart cache-or-fetch pattern
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number,
    version?: string
  ): Promise<T> {
    const cached = this.get<T>(key, version);
    if (cached !== null) {
      return cached;
    }

    console.log(`[Production Cache] 🔄 Fetching fresh data: ${key}`);
    const data = await fetchFn();
    this.set(key, data, ttl, version);
    return data;
  }

  // Invalidate cache entries by pattern
  invalidatePattern(pattern: string): number {
    let invalidated = 0;
    const regex = new RegExp(pattern);

    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    console.log(`[Production Cache] 🗑️ Invalidated ${invalidated} entries matching: ${pattern}`);
    return invalidated;
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[Production Cache] 🧹 Cleared ${size} cache entries`);
  }

  // Detect and clear stale cache from different app versions
  private detectAndClearStaleCache(): void {
    const currentVersion = '1.0.0'; // In production, get from build
    const lastVersion = localStorage.getItem('app_version');

    if (lastVersion && lastVersion !== currentVersion) {
      console.log(`[Production Cache] 🔄 App version changed: ${lastVersion} -> ${currentVersion}`);
      this.clear();
      
      // Also clear localStorage cache
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.config.prefix)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`[Production Cache] 🧹 Cleared ${keysToRemove.length} localStorage entries`);
    }

    localStorage.setItem('app_version', currentVersion);
  }

  // Evict least recently used entries
  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let minHits = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.hits < minHits) {
        minHits = entry.hits;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      console.log(`[Production Cache] 🗑️ Evicted least used: ${leastUsedKey}`);
    }
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Production Cache] 🧹 Cleaned up ${cleaned} expired entries`);
    }
  }

  // Start automatic cleanup routine
  private startCleanupRoutine(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  // Get cache statistics
  getStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      utilizationPercent: (this.cache.size / this.config.maxSize) * 100,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        hits: entry.hits,
        ttl: entry.ttl
      }))
    };

    console.log('[Production Cache] 📊 Cache stats:', {
      size: stats.size,
      utilization: `${stats.utilizationPercent.toFixed(1)}%`
    });

    return stats;
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    console.log('[Production Cache] 🛑 Cache service destroyed');
  }
}

// Export singleton instance
export const productionCache = ProductionCacheService.getInstance();
