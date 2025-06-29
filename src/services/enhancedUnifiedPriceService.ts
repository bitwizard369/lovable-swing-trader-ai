interface PriceData {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  symbol: string;
  volume?: number;
  high24h?: number;
  low24h?: number;
  change24h?: number;
  changePercent24h?: number;
}

interface PriceSource {
  name: string;
  weight: number;
  isActive: boolean;
  lastUpdate: number;
  errorCount: number;
  maxErrors: number;
}

interface PriceCalculationOptions {
  useWeightedAverage: boolean;
  outlierDetection: boolean;
  minimumSources: number;
  staleDataThresholdMs: number;
}

const DEFAULT_OPTIONS: PriceCalculationOptions = {
  useWeightedAverage: true,
  outlierDetection: true,
  minimumSources: 1,
  staleDataThresholdMs: 5000
};

export class EnhancedUnifiedPriceService {
  private static instances: Map<string, EnhancedUnifiedPriceService> = new Map();
  
  private symbol: string;
  private currentPrice: PriceData | null = null;
  private priceHistory: PriceData[] = [];
  private subscribers: Set<(price: PriceData) => void> = new Set();
  private sources: Map<string, PriceSource> = new Map();
  private options: PriceCalculationOptions;
  private updateTimer: number | null = null;
  private cleanupTimer: number | null = null;
  
  // Performance metrics
  private metrics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    averageUpdateTime: 0,
    lastUpdateDuration: 0
  };

  private constructor(symbol: string = 'btcusdt', options: Partial<PriceCalculationOptions> = {}) {
    this.symbol = symbol.toLowerCase();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Initialize default sources
    this.initializeSources();
    
    // Start background tasks
    this.startUpdateTimer();
    this.startCleanupTimer();
    
    console.log(`[Enhanced Price Service] 🏪 Initialized for ${this.symbol.toUpperCase()}`);
  }

  static getInstance(symbol?: string, options?: Partial<PriceCalculationOptions>): EnhancedUnifiedPriceService {
    const key = symbol || 'btcusdt';
    
    if (!EnhancedUnifiedPriceService.instances.has(key)) {
      EnhancedUnifiedPriceService.instances.set(key, new EnhancedUnifiedPriceService(key, options));
    }
    
    return EnhancedUnifiedPriceService.instances.get(key)!;
  }

  private initializeSources(): void {
    // WebSocket source (primary)
    this.sources.set('websocket', {
      name: 'WebSocket',
      weight: 0.8,
      isActive: false,
      lastUpdate: 0,
      errorCount: 0,
      maxErrors: 5
    });

    // REST API source (backup)
    this.sources.set('rest', {
      name: 'REST API',
      weight: 0.2,
      isActive: true,
      lastUpdate: 0,
      errorCount: 0,
      maxErrors: 10
    });
  }

  private startUpdateTimer(): void {
    // Update from REST API every 5 seconds as backup
    this.updateTimer = window.setInterval(() => {
      this.updateFromRestAPI();
    }, 5000);
  }

  private startCleanupTimer(): void {
    // Cleanup old data every minute
    this.cleanupTimer = window.setInterval(() => {
      this.cleanupOldData();
    }, 60000);
  }

  private async updateFromRestAPI(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(
        `https://api.binance.us/api/v3/ticker/bookTicker?symbol=${this.symbol.toUpperCase()}`,
        { 
          cache: 'no-cache',
          signal: AbortSignal.timeout(3000)
        }
      );

      if (!response.ok) {
        throw new Error(`REST API error: ${response.status}`);
      }

      const data = await response.json();
      
      const priceData: PriceData = {
        bid: parseFloat(data.bidPrice),
        ask: parseFloat(data.askPrice),
        mid: (parseFloat(data.bidPrice) + parseFloat(data.askPrice)) / 2,
        spread: parseFloat(data.askPrice) - parseFloat(data.bidPrice),
        timestamp: Date.now(),
        symbol: this.symbol
      };

      this.updatePrice(priceData, 'rest');
      
      // Update source status
      const source = this.sources.get('rest')!;
      source.lastUpdate = Date.now();
      source.errorCount = 0;
      source.isActive = true;

    } catch (error) {
      console.warn(`[Enhanced Price Service] REST API update failed:`, error);
      this.handleSourceError('rest');
    } finally {
      const duration = performance.now() - startTime;
      this.updateMetrics(duration);
    }
  }

  updatePrice(priceData: PriceData, sourceName: string): void {
    if (!this.isValidPriceData(priceData)) {
      console.warn('[Enhanced Price Service] Invalid price data received:', priceData);
      return;
    }

    // Update source activity
    const source = this.sources.get(sourceName);
    if (source) {
      source.isActive = true;
      source.lastUpdate = Date.now();
    }

    // Store in history
    this.priceHistory.push(priceData);
    
    // Keep only recent history (last 1000 entries)
    if (this.priceHistory.length > 1000) {
      this.priceHistory = this.priceHistory.slice(-1000);
    }

    // Calculate unified price if we have multiple sources
    const unifiedPrice = this.calculateUnifiedPrice(priceData);
    
    // Update current price
    this.currentPrice = unifiedPrice;
    
    // Notify subscribers
    this.notifySubscribers(unifiedPrice);
    
    this.metrics.successfulUpdates++;
    console.log(`[Enhanced Price Service] 📊 Price updated: ${unifiedPrice.mid.toFixed(2)}`);
  }

  private calculateUnifiedPrice(newPrice: PriceData): PriceData {
    if (!this.options.useWeightedAverage || this.priceHistory.length < 2) {
      return newPrice;
    }

    // Get recent prices (last 10 seconds)
    const recentPrices = this.priceHistory.filter(
      p => Date.now() - p.timestamp < 10000
    );

    if (recentPrices.length < 2) {
      return newPrice;
    }

    // Calculate weighted average
    let totalWeight = 0;
    let weightedBid = 0;
    let weightedAsk = 0;

    recentPrices.forEach(price => {
      const age = Date.now() - price.timestamp;
      const weight = Math.exp(-age / 5000); // Exponential decay
      
      totalWeight += weight;
      weightedBid += price.bid * weight;
      weightedAsk += price.ask * weight;
    });

    if (totalWeight === 0) {
      return newPrice;
    }

    const avgBid = weightedBid / totalWeight;
    const avgAsk = weightedAsk / totalWeight;

    return {
      ...newPrice,
      bid: avgBid,
      ask: avgAsk,
      mid: (avgBid + avgAsk) / 2,
      spread: avgAsk - avgBid
    };
  }

  private isValidPriceData(data: PriceData): boolean {
    return (
      data &&
      typeof data.bid === 'number' &&
      typeof data.ask === 'number' &&
      data.bid > 0 &&
      data.ask > 0 &&
      data.ask >= data.bid &&
      data.spread >= 0 &&
      data.timestamp > 0
    );
  }

  private handleSourceError(sourceName: string): void {
    const source = this.sources.get(sourceName);
    if (!source) return;

    source.errorCount++;
    
    if (source.errorCount >= source.maxErrors) {
      source.isActive = false;
      console.warn(`[Enhanced Price Service] Source ${sourceName} deactivated due to errors`);
    }
  }

  private notifySubscribers(price: PriceData): void {
    this.subscribers.forEach(callback => {
      try {
        callback(price);
      } catch (error) {
        console.error('[Enhanced Price Service] Subscriber error:', error);
      }
    });
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
    
    this.priceHistory = this.priceHistory.filter(p => p.timestamp > cutoffTime);
    
    console.log(`[Enhanced Price Service] 🧹 Cleaned up old data, ${this.priceHistory.length} entries remaining`);
  }

  private updateMetrics(duration: number): void {
    this.metrics.totalUpdates++;
    this.metrics.lastUpdateDuration = duration;
    
    // Calculate rolling average
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageUpdateTime = 
      (1 - alpha) * this.metrics.averageUpdateTime + alpha * duration;
  }

  // Public API
  getCurrentPrice(): PriceData | null {
    return this.currentPrice ? { ...this.currentPrice } : null;
  }

  subscribe(callback: (price: PriceData) => void): () => void {
    this.subscribers.add(callback);
    
    // Immediately provide current price if available
    if (this.currentPrice) {
      try {
        callback(this.currentPrice);
      } catch (error) {
        console.error('[Enhanced Price Service] Immediate callback error:', error);
      }
    }
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  getPriceHistory(limit?: number): PriceData[] {
    const history = [...this.priceHistory];
    return limit ? history.slice(-limit) : history;
  }

  getMetrics() {
    return {
      ...this.metrics,
      subscriberCount: this.subscribers.size,
      historySize: this.priceHistory.length,
      activeSources: Array.from(this.sources.values()).filter(s => s.isActive).length,
      sources: Array.from(this.sources.entries()).map(([name, source]) => ({
        name,
        ...source
      }))
    };
  }

  isStale(thresholdMs?: number): boolean {
    if (!this.currentPrice) return true;
    
    const threshold = thresholdMs || this.options.staleDataThresholdMs;
    return Date.now() - this.currentPrice.timestamp > threshold;
  }

  // Lifecycle management
  cleanup(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.subscribers.clear();
    this.priceHistory = [];
    this.currentPrice = null;
    
    console.log(`[Enhanced Price Service] 🧹 Cleanup completed for ${this.symbol.toUpperCase()}`);
  }

  static cleanupAll(): void {
    EnhancedUnifiedPriceService.instances.forEach(instance => {
      instance.cleanup();
    });
    EnhancedUnifiedPriceService.instances.clear();
    console.log('[Enhanced Price Service] 🧹 All instances cleaned up');
  }
}
