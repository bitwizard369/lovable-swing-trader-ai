import { Position } from '@/types/trading';
import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';

export interface MeanReversionLevels {
  takeProfitPrice: number;
  stopLossPrice: number;
  trailingStopPrice?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  meanReversionTarget: number;
  vwapDeviationTarget: number;
  exitReason?: 'MEAN_REVERSION' | 'SUPPORT_RESISTANCE' | 'VWAP_DEVIATION' | 'TRAILING_STOP';
}

export interface LearningData {
  signalAttempt?: {
    timestamp: number;
    indicators: AdvancedIndicators;
    marketContext: MarketContext;
    orderBookImbalance: number;
    prediction: any;
    wasExecuted: boolean;
    executionReason?: string;
  };
  marketContextChange?: {
    timestamp: number;
    previousRegime: string;
    newRegime: string;
    previousVolatility: string;
    newVolatility: string;
  };
  orderBookPattern?: {
    timestamp: number;
    imbalance: number;
    spreadQuality: number;
    liquidityScore: number;
    priceAction: 'UP' | 'DOWN' | 'SIDEWAYS';
  };
  exitEffectiveness?: {
    timestamp: number;
    exitReason: string;
    profitLoss: number;
    holdTime: number;
    marketConditions: MarketContext;
    success: boolean;
  };
}

export class MeanReversionTPSLService {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private learningData: LearningData[] = [];
  private supportResistanceLevels: { support: number[]; resistance: number[] } = { support: [], resistance: [] };

  constructor() {
    console.log('[Mean Reversion] 🎯 Service initialized with advanced TP/SL system');
    this.loadLearningData();
  }

  private loadLearningData(): void {
    try {
      const stored = localStorage.getItem('meanReversion_learningData');
      if (stored) {
        this.learningData = JSON.parse(stored);
        console.log(`[Mean Reversion] 📚 Loaded ${this.learningData.length} learning data points`);
      }
    } catch (error) {
      console.error('[Mean Reversion] ❌ Failed to load learning data:', error);
    }
  }

  private saveLearningData(): void {
    try {
      // Keep only last 1000 data points to prevent storage bloat
      const dataToStore = this.learningData.slice(-1000);
      localStorage.setItem('meanReversion_learningData', JSON.stringify(dataToStore));
    } catch (error) {
      console.error('[Mean Reversion] ❌ Failed to save learning data:', error);
    }
  }

  public updatePriceData(price: number, volume: number = 0): void {
    this.priceHistory.push(price);
    this.volumeHistory.push(volume);
    
    // Keep only last 200 data points for performance
    if (this.priceHistory.length > 200) {
      this.priceHistory = this.priceHistory.slice(-200);
      this.volumeHistory = this.volumeHistory.slice(-200);
    }

    // Update support/resistance levels
    this.updateSupportResistanceLevels();
  }

  private updateSupportResistanceLevels(): void {
    if (this.priceHistory.length < 20) return;

    const recentPrices = this.priceHistory.slice(-50);
    const localMinima: number[] = [];
    const localMaxima: number[] = [];

    // Find local minima and maxima
    for (let i = 2; i < recentPrices.length - 2; i++) {
      const current = recentPrices[i];
      const prev2 = recentPrices[i - 2];
      const prev1 = recentPrices[i - 1];
      const next1 = recentPrices[i + 1];
      const next2 = recentPrices[i + 2];

      // Local minimum
      if (current < prev2 && current < prev1 && current < next1 && current < next2) {
        localMinima.push(current);
      }
      // Local maximum
      if (current > prev2 && current > prev1 && current > next1 && current > next2) {
        localMaxima.push(current);
      }
    }

    // Cluster nearby levels
    this.supportResistanceLevels.support = this.clusterLevels(localMinima);
    this.supportResistanceLevels.resistance = this.clusterLevels(localMaxima);

    console.log(`[Mean Reversion] 📊 Updated S/R levels - Support: ${this.supportResistanceLevels.support.length}, Resistance: ${this.supportResistanceLevels.resistance.length}`);
  }

  private clusterLevels(levels: number[]): number[] {
    if (levels.length === 0) return [];

    const clustered: number[] = [];
    const sorted = [...levels].sort((a, b) => a - b);
    const threshold = sorted[sorted.length - 1] * 0.005; // 0.5% clustering threshold

    let currentCluster = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= threshold) {
        currentCluster.push(sorted[i]);
      } else {
        // Finalize current cluster
        const clusterAvg = currentCluster.reduce((sum, val) => sum + val, 0) / currentCluster.length;
        clustered.push(clusterAvg);
        currentCluster = [sorted[i]];
      }
    }

    // Add the last cluster
    if (currentCluster.length > 0) {
      const clusterAvg = currentCluster.reduce((sum, val) => sum + val, 0) / currentCluster.length;
      clustered.push(clusterAvg);
    }

    return clustered;
  }

  public calculateMeanReversionLevels(
    position: Position,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): MeanReversionLevels {
    const currentPrice = position.currentPrice;
    const entryPrice = position.entryPrice;

    // 1. Bollinger Band Mean Reversion
    const meanReversionTarget = this.calculateBollingerMeanReversion(indicators, currentPrice, position.side);

    // 2. VWAP Deviation Target
    const vwapDeviationTarget = this.calculateVWAPDeviation(indicators, currentPrice, position.side);

    // 3. Support/Resistance Based Exits
    const srLevels = this.calculateSupportResistanceLevels(currentPrice, position.side);

    // 4. Trailing Stop with ATR and Volatility
    const trailingStop = this.calculateTrailingStop(position, indicators, marketContext);

    // Select optimal TP/SL based on market conditions
    const optimalLevels = this.selectOptimalLevels(
      position,
      meanReversionTarget,
      vwapDeviationTarget,
      srLevels,
      trailingStop,
      marketContext
    );

    console.log(`[Mean Reversion] 🎯 Calculated levels for ${position.symbol}: TP=${optimalLevels.takeProfitPrice.toFixed(2)}, SL=${optimalLevels.stopLossPrice.toFixed(2)}`);

    return optimalLevels;
  }

  private calculateBollingerMeanReversion(indicators: AdvancedIndicators, currentPrice: number, side: 'BUY' | 'SELL'): number {
    if (!indicators.bollinger_middle || !indicators.bollinger_upper || !indicators.bollinger_lower) {
      return currentPrice;
    }

    const middle = indicators.bollinger_middle;
    const upper = indicators.bollinger_upper;
    const lower = indicators.bollinger_lower;
    const bandWidth = upper - lower;

    if (side === 'BUY') {
      // For long positions, target is moving toward middle from lower band
      const distanceFromLower = currentPrice - lower;
      const reversionStrength = Math.min(1, distanceFromLower / (bandWidth * 0.5));
      return middle - (bandWidth * 0.1 * (1 - reversionStrength));
    } else {
      // For short positions, target is moving toward middle from upper band
      const distanceFromUpper = upper - currentPrice;
      const reversionStrength = Math.min(1, distanceFromUpper / (bandWidth * 0.5));
      return middle + (bandWidth * 0.1 * (1 - reversionStrength));
    }
  }

  private calculateVWAPDeviation(indicators: AdvancedIndicators, currentPrice: number, side: 'BUY' | 'SELL'): number {
    if (!indicators.vwap) return currentPrice;

    const vwap = indicators.vwap;
    const deviation = Math.abs(currentPrice - vwap) / vwap;
    
    // Calculate standard deviation of recent prices for VWAP bands
    const recentPrices = this.priceHistory.slice(-20);
    if (recentPrices.length < 5) return currentPrice;

    const mean = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / recentPrices.length;
    const stdDev = Math.sqrt(variance);

    if (side === 'BUY') {
      // Target VWAP + small premium for long positions
      return vwap + (stdDev * 0.5);
    } else {
      // Target VWAP - small discount for short positions
      return vwap - (stdDev * 0.5);
    }
  }

  private calculateSupportResistanceLevels(currentPrice: number, side: 'BUY' | 'SELL'): { takeProfit: number; stopLoss: number } {
    if (side === 'BUY') {
      // For long positions: TP at nearest resistance, SL below nearest support
      const nearestResistance = this.supportResistanceLevels.resistance
        .filter(level => level > currentPrice)
        .sort((a, b) => a - b)[0];
      
      const nearestSupport = this.supportResistanceLevels.support
        .filter(level => level < currentPrice)
        .sort((a, b) => b - a)[0];

      return {
        takeProfit: nearestResistance || currentPrice * 1.015,
        stopLoss: nearestSupport ? nearestSupport * 0.995 : currentPrice * 0.992
      };
    } else {
      // For short positions: TP at nearest support, SL above nearest resistance
      const nearestSupport = this.supportResistanceLevels.support
        .filter(level => level < currentPrice)
        .sort((a, b) => b - a)[0];
      
      const nearestResistance = this.supportResistanceLevels.resistance
        .filter(level => level > currentPrice)
        .sort((a, b) => a - b)[0];

      return {
        takeProfit: nearestSupport || currentPrice * 0.985,
        stopLoss: nearestResistance ? nearestResistance * 1.005 : currentPrice * 1.008
      };
    }
  }

  private calculateTrailingStop(position: Position, indicators: AdvancedIndicators, marketContext: MarketContext): number {
    const atr = indicators.atr || (position.currentPrice * 0.01); // Fallback 1% if no ATR
    const volatilityMultiplier = marketContext.volatilityRegime === 'HIGH' ? 2.5 :
                                marketContext.volatilityRegime === 'MEDIUM' ? 1.8 : 1.2;

    const trailingDistance = atr * volatilityMultiplier;

    if (position.side === 'BUY') {
      return position.currentPrice - trailingDistance;
    } else {
      return position.currentPrice + trailingDistance;
    }
  }

  private selectOptimalLevels(
    position: Position,
    meanReversionTarget: number,
    vwapDeviationTarget: number,
    srLevels: { takeProfit: number; stopLoss: number },
    trailingStop: number,
    marketContext: MarketContext
  ): MeanReversionLevels {
    const currentPrice = position.currentPrice;
    
    // Weight different targets based on market conditions
    let takeProfitPrice: number;
    let stopLossPrice: number;
    let exitReason: MeanReversionLevels['exitReason'] = 'MEAN_REVERSION';

    // Select take profit based on market regime
    if (marketContext.marketRegime.includes('SIDEWAYS')) {
      // In sideways markets, prefer mean reversion
      takeProfitPrice = meanReversionTarget;
      exitReason = 'MEAN_REVERSION';
    } else if (marketContext.liquidityScore > 0.7) {
      // High liquidity: use VWAP deviation
      takeProfitPrice = vwapDeviationTarget;
      exitReason = 'VWAP_DEVIATION';
    } else {
      // Use support/resistance levels
      takeProfitPrice = srLevels.takeProfit;
      exitReason = 'SUPPORT_RESISTANCE';
    }

    // Always use tighter of trailing stop or S/R stop loss
    if (position.side === 'BUY') {
      stopLossPrice = Math.max(trailingStop, srLevels.stopLoss);
    } else {
      stopLossPrice = Math.min(trailingStop, srLevels.stopLoss);
    }

    return {
      takeProfitPrice,
      stopLossPrice,
      trailingStopPrice: trailingStop,
      supportLevel: this.supportResistanceLevels.support[0],
      resistanceLevel: this.supportResistanceLevels.resistance[0],
      meanReversionTarget,
      vwapDeviationTarget,
      exitReason
    };
  }

  // Learning system methods
  public logSignalAttempt(
    indicators: AdvancedIndicators,
    marketContext: MarketContext,
    orderBookImbalance: number,
    prediction: any,
    wasExecuted: boolean,
    executionReason?: string
  ): void {
    const learningData: LearningData = {
      signalAttempt: {
        timestamp: Date.now(),
        indicators,
        marketContext,
        orderBookImbalance,
        prediction,
        wasExecuted,
        executionReason
      }
    };

    this.learningData.push(learningData);
    this.saveLearningData();

    console.log(`[Mean Reversion] 📚 Logged signal attempt: executed=${wasExecuted}, reason=${executionReason}`);
  }

  public logMarketContextChange(previousContext: MarketContext, newContext: MarketContext): void {
    if (previousContext.marketRegime !== newContext.marketRegime || 
        previousContext.volatilityRegime !== newContext.volatilityRegime) {
      
      const learningData: LearningData = {
        marketContextChange: {
          timestamp: Date.now(),
          previousRegime: previousContext.marketRegime,
          newRegime: newContext.marketRegime,
          previousVolatility: previousContext.volatilityRegime,
          newVolatility: newContext.volatilityRegime
        }
      };

      this.learningData.push(learningData);
      this.saveLearningData();

      console.log(`[Mean Reversion] 📚 Logged market regime change: ${previousContext.marketRegime} -> ${newContext.marketRegime}`);
    }
  }

  public logOrderBookPattern(imbalance: number, spreadQuality: number, liquidityScore: number, priceAction: 'UP' | 'DOWN' | 'SIDEWAYS'): void {
    const learningData: LearningData = {
      orderBookPattern: {
        timestamp: Date.now(),
        imbalance,
        spreadQuality,
        liquidityScore,
        priceAction
      }
    };

    this.learningData.push(learningData);
    this.saveLearningData();
  }

  public logExitEffectiveness(
    exitReason: string,
    profitLoss: number,
    holdTime: number,
    marketConditions: MarketContext,
    success: boolean
  ): void {
    const learningData: LearningData = {
      exitEffectiveness: {
        timestamp: Date.now(),
        exitReason,
        profitLoss,
        holdTime,
        marketConditions,
        success
      }
    };

    this.learningData.push(learningData);
    this.saveLearningData();

    console.log(`[Mean Reversion] 📚 Logged exit effectiveness: ${exitReason}, P&L=${profitLoss.toFixed(2)}, success=${success}`);
  }

  public getLearningAnalytics(): any {
    const recentData = this.learningData.filter(d => Date.now() - (d.signalAttempt?.timestamp || d.marketContextChange?.timestamp || d.orderBookPattern?.timestamp || d.exitEffectiveness?.timestamp || 0) < 24 * 60 * 60 * 1000);

    const signalAttempts = recentData.filter(d => d.signalAttempt).length;
    const executedSignals = recentData.filter(d => d.signalAttempt?.wasExecuted).length;
    const marketChanges = recentData.filter(d => d.marketContextChange).length;
    const exitData = recentData.filter(d => d.exitEffectiveness);

    const exitEffectiveness = exitData.reduce((acc, d) => {
      const reason = d.exitEffectiveness!.exitReason;
      if (!acc[reason]) acc[reason] = { count: 0, successRate: 0, avgPnL: 0 };
      acc[reason].count++;
      acc[reason].successRate += d.exitEffectiveness!.success ? 1 : 0;
      acc[reason].avgPnL += d.exitEffectiveness!.profitLoss;
      return acc;
    }, {} as any);

    // Calculate success rates and average P&L
    Object.keys(exitEffectiveness).forEach(reason => {
      const data = exitEffectiveness[reason];
      data.successRate = data.successRate / data.count;
      data.avgPnL = data.avgPnL / data.count;
    });

    return {
      totalLearningPoints: this.learningData.length,
      recentSignalAttempts: signalAttempts,
      executionRate: signalAttempts > 0 ? executedSignals / signalAttempts : 0,
      recentMarketChanges: marketChanges,
      exitEffectiveness,
      supportResistanceLevels: this.supportResistanceLevels
    };
  }

  public getAdaptiveThresholds(): any {
    const analytics = this.getLearningAnalytics();
    const baseThresholds = {
      minProbability: 0.52,
      minConfidence: 0.35,
      maxRiskScore: 0.75
    };

    // Adjust thresholds based on recent performance
    if (analytics.executionRate > 0) {
      const performanceMultiplier = Math.min(1.2, Math.max(0.8, analytics.executionRate));
      baseThresholds.minProbability *= performanceMultiplier;
      baseThresholds.minConfidence *= performanceMultiplier;
    }

    return baseThresholds;
  }
}
