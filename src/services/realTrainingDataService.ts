
import { TradeOutcome, PredictionInput, PredictionOutput } from './aiPredictionModel';
import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';

interface RealTradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  entryTime: number;
  exitTime: number;
  profitLoss: number;
  returnPercentage: number;
  holdingTimeSeconds: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  marketContext: MarketContext;
  indicators: AdvancedIndicators;
  predictionAtEntry: PredictionOutput;
  actualOutcome: 'WIN' | 'LOSS';
  exitReason: string;
}

interface MarketDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  spread: number;
  bidQuantity: number;
  askQuantity: number;
  orderBookImbalance: number;
  indicators: Partial<AdvancedIndicators>;
  marketContext: Partial<MarketContext>;
}

export class RealTrainingDataService {
  private tradeHistory: RealTradeRecord[] = [];
  private marketDataHistory: MarketDataPoint[] = [];
  private readonly MAX_TRADE_HISTORY = 1000;
  private readonly MAX_MARKET_DATA = 5000;
  private readonly STORAGE_KEY = 'real_trading_data';
  private readonly MARKET_DATA_KEY = 'real_market_data';

  constructor() {
    this.loadStoredData();
    console.log(`[Real Training Data] 📊 Initialized with ${this.tradeHistory.length} real trades and ${this.marketDataHistory.length} market data points`);
  }

  // Record actual trade outcomes from real demo trading
  recordRealTrade(
    symbol: string,
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    side: 'BUY' | 'SELL',
    entryTime: number,
    exitTime: number,
    maxFavorableExcursion: number,
    maxAdverseExcursion: number,
    marketContext: MarketContext,
    indicators: AdvancedIndicators,
    predictionAtEntry: PredictionOutput,
    exitReason: string
  ): RealTradeRecord {
    const profitLoss = side === 'BUY' 
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    
    const returnPercentage = ((exitPrice - entryPrice) / entryPrice) * 100 * (side === 'BUY' ? 1 : -1);
    const holdingTimeSeconds = (exitTime - entryTime) / 1000;

    const tradeRecord: RealTradeRecord = {
      id: `${symbol}_${entryTime}_${Date.now()}`,
      timestamp: exitTime,
      symbol,
      entryPrice,
      exitPrice,
      quantity,
      side,
      entryTime,
      exitTime,
      profitLoss,
      returnPercentage,
      holdingTimeSeconds,
      maxFavorableExcursion,
      maxAdverseExcursion,
      marketContext: { ...marketContext },
      indicators: { ...indicators },
      predictionAtEntry: { ...predictionAtEntry },
      actualOutcome: profitLoss > 0 ? 'WIN' : 'LOSS',
      exitReason
    };

    this.tradeHistory.push(tradeRecord);
    
    // Maintain size limit
    if (this.tradeHistory.length > this.MAX_TRADE_HISTORY) {
      this.tradeHistory = this.tradeHistory.slice(-this.MAX_TRADE_HISTORY);
    }

    this.saveToStorage();

    console.log(`[Real Training Data] ✅ Recorded real trade: ${side} ${quantity.toFixed(6)} ${symbol} | P&L: ${profitLoss.toFixed(2)} | Return: ${returnPercentage.toFixed(2)}% | Reason: ${exitReason}`);
    console.log(`[Real Training Data] 📈 Prediction accuracy - Expected: ${predictionAtEntry.expectedReturn.toFixed(2)}%, Actual: ${returnPercentage.toFixed(2)}%`);

    return tradeRecord;
  }

  // Record real market data continuously
  recordMarketData(
    price: number,
    volume: number,
    spread: number,
    bidQuantity: number,
    askQuantity: number,
    orderBookImbalance: number,
    indicators: Partial<AdvancedIndicators>,
    marketContext: Partial<MarketContext>
  ): void {
    const dataPoint: MarketDataPoint = {
      timestamp: Date.now(),
      price,
      volume,
      spread,
      bidQuantity,
      askQuantity,
      orderBookImbalance,
      indicators: { ...indicators },
      marketContext: { ...marketContext }
    };

    this.marketDataHistory.push(dataPoint);

    // Maintain size limit
    if (this.marketDataHistory.length > this.MAX_MARKET_DATA) {
      this.marketDataHistory = this.marketDataHistory.slice(-this.MAX_MARKET_DATA);
    }

    // Save every 50 data points to avoid excessive storage operations
    if (this.marketDataHistory.length % 50 === 0) {
      this.saveMarketDataToStorage();
    }
  }

  // Convert real trade records to training data format
  getRealTrainingData(): TradeOutcome[] {
    return this.tradeHistory.map(trade => ({
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      profitLoss: trade.profitLoss,
      holdingTime: trade.holdingTimeSeconds,
      prediction: trade.predictionAtEntry,
      actualReturn: trade.returnPercentage,
      success: trade.actualOutcome === 'WIN',
      maxAdverseExcursion: trade.maxAdverseExcursion,
      maxFavorableExcursion: trade.maxFavorableExcursion
    }));
  }

  // Get real market statistics for model calibration
  getRealMarketStatistics() {
    if (this.tradeHistory.length === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        avgReturn: 0,
        avgHoldingTime: 0,
        avgMAE: 0,
        avgMFE: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        bestTrade: 0,
        worstTrade: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0
      };
    }

    const wins = this.tradeHistory.filter(t => t.actualOutcome === 'WIN');
    const losses = this.tradeHistory.filter(t => t.actualOutcome === 'LOSS');
    
    const totalReturn = this.tradeHistory.reduce((sum, t) => sum + t.returnPercentage, 0);
    const avgReturn = totalReturn / this.tradeHistory.length;
    
    const grossProfit = wins.reduce((sum, t) => sum + Math.abs(t.returnPercentage), 0);
    const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.returnPercentage), 0);
    
    const returns = this.tradeHistory.map(t => t.returnPercentage);
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    
    return {
      totalTrades: this.tradeHistory.length,
      winRate: wins.length / this.tradeHistory.length,
      avgReturn,
      avgHoldingTime: this.tradeHistory.reduce((sum, t) => sum + t.holdingTimeSeconds, 0) / this.tradeHistory.length,
      avgMAE: this.tradeHistory.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / this.tradeHistory.length,
      avgMFE: this.tradeHistory.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / this.tradeHistory.length,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      sharpeRatio: stdDev > 0 ? avgReturn / stdDev : 0,
      maxDrawdown: this.calculateMaxDrawdown(),
      bestTrade: Math.max(...returns),
      worstTrade: Math.min(...returns),
      consecutiveWins: this.calculateConsecutiveWins(),
      consecutiveLosses: this.calculateConsecutiveLosses()
    };
  }

  // Get real market patterns for better predictions
  getMarketPatterns() {
    if (this.marketDataHistory.length < 100) return null;

    const recent = this.marketDataHistory.slice(-100);
    const prices = recent.map(d => d.price);
    const volumes = recent.map(d => d.volume);
    const spreads = recent.map(d => d.spread);

    return {
      avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      priceVolatility: this.calculateVolatility(prices),
      avgVolume: volumes.reduce((sum, v) => sum + v, 0) / volumes.length,
      volumeVolatility: this.calculateVolatility(volumes),
      avgSpread: spreads.reduce((sum, s) => sum + s, 0) / spreads.length,
      trendDirection: this.calculateTrendDirection(prices),
      marketEfficiency: this.calculateMarketEfficiency(recent)
    };
  }

  // Check if we have enough real data to train effectively
  hasEnoughRealData(): boolean {
    return this.tradeHistory.length >= 20 && this.marketDataHistory.length >= 500;
  }

  // Get data quality metrics
  getDataQuality() {
    const now = Date.now();
    const recentTrades = this.tradeHistory.filter(t => now - t.timestamp < 24 * 60 * 60 * 1000); // Last 24 hours
    const recentMarketData = this.marketDataHistory.filter(d => now - d.timestamp < 60 * 60 * 1000); // Last hour

    return {
      totalTrades: this.tradeHistory.length,
      recentTrades: recentTrades.length,
      totalMarketDataPoints: this.marketDataHistory.length,
      recentMarketDataPoints: recentMarketData.length,
      dataFreshness: this.marketDataHistory.length > 0 ? now - this.marketDataHistory[this.marketDataHistory.length - 1].timestamp : 0,
      predictionAccuracy: this.calculatePredictionAccuracy(),
      isRealData: true,
      lastUpdated: new Date().toISOString()
    };
  }

  private calculateMaxDrawdown(): number {
    if (this.tradeHistory.length === 0) return 0;
    
    let runningReturn = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const trade of this.tradeHistory) {
      runningReturn += trade.returnPercentage;
      peak = Math.max(peak, runningReturn);
      const drawdown = peak - runningReturn;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateConsecutiveWins(): number {
    let maxConsecutive = 0;
    let current = 0;
    
    for (const trade of this.tradeHistory) {
      if (trade.actualOutcome === 'WIN') {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }
    
    return maxConsecutive;
  }

  private calculateConsecutiveLosses(): number {
    let maxConsecutive = 0;
    let current = 0;
    
    for (const trade of this.tradeHistory) {
      if (trade.actualOutcome === 'LOSS') {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }
    
    return maxConsecutive;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateTrendDirection(prices: number[]): 'UP' | 'DOWN' | 'SIDEWAYS' {
    if (prices.length < 10) return 'SIDEWAYS';
    
    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.001) return 'UP';
    if (change < -0.001) return 'DOWN';
    return 'SIDEWAYS';
  }

  private calculateMarketEfficiency(dataPoints: MarketDataPoint[]): number {
    if (dataPoints.length < 2) return 0;
    
    const priceChanges = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const change = (dataPoints[i].price - dataPoints[i-1].price) / dataPoints[i-1].price;
      priceChanges.push(Math.abs(change));
    }
    
    const avgPriceChange = priceChanges.reduce((sum, c) => sum + c, 0) / priceChanges.length;
    const avgSpread = dataPoints.reduce((sum, d) => sum + d.spread, 0) / dataPoints.length;
    
    // Market efficiency: lower spread relative to price movement = more efficient
    return avgPriceChange > 0 ? Math.min(1, avgSpread / avgPriceChange) : 1;
  }

  private calculatePredictionAccuracy(): number {
    if (this.tradeHistory.length === 0) return 0;
    
    let correctPredictions = 0;
    
    for (const trade of this.tradeHistory) {
      const predictedDirection = trade.predictionAtEntry.probability > 0.5;
      const actualDirection = trade.actualOutcome === 'WIN';
      
      if (predictedDirection === actualDirection) {
        correctPredictions++;
      }
    }
    
    return correctPredictions / this.tradeHistory.length;
  }

  private loadStoredData(): void {
    try {
      const storedTrades = localStorage.getItem(this.STORAGE_KEY);
      if (storedTrades) {
        this.tradeHistory = JSON.parse(storedTrades);
        console.log(`[Real Training Data] 📁 Loaded ${this.tradeHistory.length} real trades from storage`);
      }

      const storedMarketData = localStorage.getItem(this.MARKET_DATA_KEY);
      if (storedMarketData) {
        this.marketDataHistory = JSON.parse(storedMarketData);
        console.log(`[Real Training Data] 📁 Loaded ${this.marketDataHistory.length} market data points from storage`);
      }
    } catch (error) {
      console.error('[Real Training Data] ❌ Error loading stored data:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tradeHistory));
    } catch (error) {
      console.error('[Real Training Data] ❌ Error saving trade data:', error);
    }
  }

  private saveMarketDataToStorage(): void {
    try {
      localStorage.setItem(this.MARKET_DATA_KEY, JSON.stringify(this.marketDataHistory));
    } catch (error) {
      console.error('[Real Training Data] ❌ Error saving market data:', error);
    }
  }

  // Clear all data (for testing/reset purposes)
  clearAllData(): void {
    this.tradeHistory = [];
    this.marketDataHistory = [];
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.MARKET_DATA_KEY);
    console.log('[Real Training Data] 🗑️ All real training data cleared');
  }

  // Export data for analysis
  exportData() {
    return {
      trades: this.tradeHistory,
      marketData: this.marketDataHistory,
      statistics: this.getRealMarketStatistics(),
      patterns: this.getMarketPatterns(),
      quality: this.getDataQuality()
    };
  }
}
