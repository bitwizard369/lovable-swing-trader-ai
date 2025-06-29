
interface PriceData {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  symbol: string;
}

interface PriceUpdateCallback {
  (priceData: PriceData): void;
}

export class UnifiedPriceService {
  private static instance: UnifiedPriceService;
  private currentPrice: PriceData | null = null;
  private callbacks: Set<PriceUpdateCallback> = new Set();
  private symbol: string;

  private constructor(symbol: string = 'BTCUSDT') {
    this.symbol = symbol.toUpperCase();
  }

  static getInstance(symbol?: string): UnifiedPriceService {
    if (!UnifiedPriceService.instance) {
      UnifiedPriceService.instance = new UnifiedPriceService(symbol);
    }
    return UnifiedPriceService.instance;
  }

  updatePrice(bids: { price: number; quantity: number }[], asks: { price: number; quantity: number }[]): void {
    if (!bids.length || !asks.length) return;

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;

    const newPriceData: PriceData = {
      bid: bestBid,
      ask: bestAsk,
      mid: mid,
      spread: spread,
      timestamp: Date.now(),
      symbol: this.symbol
    };

    this.currentPrice = newPriceData;
    this.notifyCallbacks(newPriceData);
  }

  getCurrentPrice(): PriceData | null {
    return this.currentPrice;
  }

  subscribe(callback: PriceUpdateCallback): () => void {
    this.callbacks.add(callback);
    
    // Immediately provide current price if available
    if (this.currentPrice) {
      callback(this.currentPrice);
    }

    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks(priceData: PriceData): void {
    this.callbacks.forEach(callback => {
      try {
        callback(priceData);
      } catch (error) {
        console.error('[Unified Price Service] Error in callback:', error);
      }
    });
  }

  // For debugging and monitoring
  getSubscriberCount(): number {
    return this.callbacks.size;
  }

  reset(): void {
    this.currentPrice = null;
    this.callbacks.clear();
  }
}
