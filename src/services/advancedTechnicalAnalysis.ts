export interface AdvancedIndicators {
  // Trend Indicators
  sma_9: number;
  sma_21: number;
  ema_12: number;
  ema_26: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  
  // Momentum Indicators
  rsi_14: number;
  stoch_k: number;
  stoch_d: number;
  williams_r: number;
  
  // Volatility Indicators
  bollinger_upper: number;
  bollinger_middle: number;
  bollinger_lower: number;
  atr: number;
  
  // Volume Indicators
  volume_sma: number;
  volume_ratio: number;
  
  // Market Structure
  support_level: number;
  resistance_level: number;
  trend_strength: number;
}

export interface MarketContext {
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH';
  marketRegime: 'STRONG_BULL' | 'WEAK_BULL' | 'STRONG_BEAR' | 'WEAK_BEAR' | 'SIDEWAYS_VOLATILE' | 'SIDEWAYS_QUIET';
  marketHour: 'LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP' | 'LOW_LIQUIDITY';
  newsImpact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class AdvancedTechnicalAnalysis {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  
  updatePriceData(price: number, volume: number = 1000) {
    this.priceHistory.push(price);
    this.volumeHistory.push(volume);
    
    // Keep only last 200 periods for performance
    if (this.priceHistory.length > 200) {
      this.priceHistory = this.priceHistory.slice(-200);
      this.volumeHistory = this.volumeHistory.slice(-200);
    }
  }
  
  getPriceHistoryLength(): number {
    return this.priceHistory.length;
  }
  
  calculateAdvancedIndicators(): AdvancedIndicators | null {
    if (this.priceHistory.length < 20) {
      console.log(`[Technical Analysis] Insufficient data: ${this.priceHistory.length}/20 required`);
      return null;
    }
    
    const prices = this.priceHistory;
    const volumes = this.volumeHistory;
    
    console.log(`[Technical Analysis] Calculating indicators with ${prices.length} price points`);
    
    return {
      // Trend Indicators
      sma_9: this.calculateSMA(prices, 9),
      sma_21: this.calculateSMA(prices, Math.min(21, prices.length)),
      ema_12: this.calculateEMA(prices, 12),
      ema_26: this.calculateEMA(prices, Math.min(26, prices.length)),
      macd: this.calculateMACD(prices).macd,
      macd_signal: this.calculateMACD(prices).signal,
      macd_histogram: this.calculateMACD(prices).histogram,
      
      // Momentum Indicators
      rsi_14: this.calculateRSI(prices, Math.min(14, prices.length - 1)),
      stoch_k: this.calculateStochastic(prices).k,
      stoch_d: this.calculateStochastic(prices).d,
      williams_r: this.calculateWilliamsR(prices, Math.min(14, prices.length)),
      
      // Volatility Indicators
      bollinger_upper: this.calculateBollingerBands(prices).upper,
      bollinger_middle: this.calculateBollingerBands(prices).middle,
      bollinger_lower: this.calculateBollingerBands(prices).lower,
      atr: this.calculateATR(prices, Math.min(14, prices.length - 1)),
      
      // Volume Indicators
      volume_sma: this.calculateSMA(volumes, Math.min(20, volumes.length)),
      volume_ratio: volumes.length > 0 ? volumes[volumes.length - 1] / this.calculateSMA(volumes, Math.min(20, volumes.length)) : 1,
      
      // Market Structure
      support_level: this.findSupportLevel(prices),
      resistance_level: this.findResistanceLevel(prices),
      trend_strength: this.calculateTrendStrength(prices)
    };
  }
  
  getMarketContext(): MarketContext {
    const currentHour = new Date().getUTCHours();
    const atr = this.priceHistory.length > 14 ? this.calculateATR(this.priceHistory, 14) : 0;
    const avgPrice = this.priceHistory.length > 0 ? this.calculateSMA(this.priceHistory, Math.min(20, this.priceHistory.length)) : 0;
    
    return {
      volatilityRegime: this.getVolatilityRegime(atr, avgPrice),
      marketRegime: this.getMarketRegime(),
      marketHour: this.getMarketHour(currentHour),
      newsImpact: 'LOW' // Placeholder - would integrate with news API
    };
  }
  
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period || period <= 0) return data.length > 0 ? data[data.length - 1] : 0;
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }
  
  private calculateEMA(data: number[], period: number): number {
    if (data.length < period || period <= 0) return data.length > 0 ? data[data.length - 1] : 0;
    
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(data.slice(0, Math.min(period, data.length)), Math.min(period, data.length));
    
    for (let i = Math.min(period, data.length); i < data.length; i++) {
      ema = (data[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  private calculateMACD(data: number[]) {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, Math.min(26, data.length));
    const macd = ema12 - ema26;
    // Simplified signal calculation for shorter data
    const signal = macd * 0.8; // Simplified instead of EMA of MACD
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }
  
  private calculateRSI(data: number[], period: number): number {
    if (data.length < period + 1 || period <= 0) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = this.calculateSMA(gains.slice(-period), period);
    const avgLoss = this.calculateSMA(losses.slice(-period), period);
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  private calculateStochastic(data: number[]) {
    const period = Math.min(14, data.length);
    if (period < 2) return { k: 50, d: 50 };
    
    const recentData = data.slice(-period);
    const high = Math.max(...recentData);
    const low = Math.min(...recentData);
    const close = data[data.length - 1];
    
    const k = ((close - low) / (high - low)) * 100;
    const d = k; // Simplified - normally would smooth %K
    
    return { k, d };
  }
  
  private calculateWilliamsR(data: number[], period: number): number {
    if (data.length < period) return -50;
    
    const recentData = data.slice(-period);
    const high = Math.max(...recentData);
    const low = Math.min(...recentData);
    const close = data[data.length - 1];
    
    return ((high - close) / (high - low)) * -100;
  }
  
  private calculateBollingerBands(data: number[]) {
    const period = Math.min(20, data.length);
    const multiplier = 2;
    
    const sma = this.calculateSMA(data, period);
    const stdDev = this.calculateStandardDeviation(data.slice(-period));
    
    return {
      upper: sma + (stdDev * multiplier),
      middle: sma,
      lower: sma - (stdDev * multiplier)
    };
  }
  
  private calculateATR(data: number[], period: number): number {
    if (data.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i];
      const low = data[i];
      const prevClose = data[i - 1];
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }
    
    return this.calculateSMA(trueRanges.slice(-period), period);
  }
  
  private calculateStandardDeviation(data: number[]): number {
    if (data.length === 0) return 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private findSupportLevel(data: number[]): number {
    // Simplified support level calculation
    const recentLows = data.slice(-Math.min(20, data.length));
    return Math.min(...recentLows);
  }
  
  private findResistanceLevel(data: number[]): number {
    // Simplified resistance level calculation
    const recentHighs = data.slice(-Math.min(20, data.length));
    return Math.max(...recentHighs);
  }
  
  private calculateTrendStrength(data: number[]): number {
    if (data.length < 12) return 0;
    
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, Math.min(26, data.length));
    const diff = Math.abs(ema12 - ema26);
    const avgPrice = this.calculateSMA(data, Math.min(20, data.length));
    
    return avgPrice > 0 ? (diff / avgPrice) * 100 : 0;
  }
  
  private getVolatilityRegime(atr: number, avgPrice: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (avgPrice === 0) return 'MEDIUM';
    const volatilityPercent = (atr / avgPrice) * 100;
    
    if (volatilityPercent < 0.5) return 'LOW';
    if (volatilityPercent < 1.5) return 'MEDIUM';
    return 'HIGH';
  }
  
  private getMarketRegime(): 'STRONG_BULL' | 'WEAK_BULL' | 'STRONG_BEAR' | 'WEAK_BEAR' | 'SIDEWAYS_VOLATILE' | 'SIDEWAYS_QUIET' {
    if (this.priceHistory.length < 26) return 'SIDEWAYS_QUIET';

    const ema9 = this.calculateEMA(this.priceHistory, 9);
    const ema21 = this.calculateEMA(this.priceHistory, 21);
    const trendStrength = this.calculateTrendStrength(this.priceHistory);
    const { upper, lower, middle } = this.calculateBollingerBands(this.priceHistory);
    const bollingerWidth = middle > 0 ? (upper - lower) / middle * 100 : 0;

    const isBullish = ema9 > ema21;
    const isBearish = ema9 < ema21;

    if (isBullish) {
        if (trendStrength > 1.0) return 'STRONG_BULL';
        return 'WEAK_BULL';
    }

    if (isBearish) {
        if (trendStrength > 1.0) return 'STRONG_BEAR';
        return 'WEAK_BEAR';
    }
    
    if (bollingerWidth > 4) {
        return 'SIDEWAYS_VOLATILE';
    }

    return 'SIDEWAYS_QUIET';
  }
  
  private getMarketHour(hour: number): 'LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP' | 'LOW_LIQUIDITY' {
    if (hour >= 8 && hour <= 16) return 'LONDON';
    if (hour >= 13 && hour <= 21) return 'NEW_YORK';
    if ((hour >= 22 && hour <= 23) || (hour >= 0 && hour <= 7)) return 'ASIA';
    if (hour >= 13 && hour <= 16) return 'OVERLAP';
    return 'LOW_LIQUIDITY';
  }
}
