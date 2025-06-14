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
  trendDirection: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
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
  
  calculateAdvancedIndicators(): AdvancedIndicators | null {
    if (this.priceHistory.length < 50) return null;
    
    const prices = this.priceHistory;
    const volumes = this.volumeHistory;
    
    return {
      // Trend Indicators
      sma_9: this.calculateSMA(prices, 9),
      sma_21: this.calculateSMA(prices, 21),
      ema_12: this.calculateEMA(prices, 12),
      ema_26: this.calculateEMA(prices, 26),
      macd: this.calculateMACD(prices).macd,
      macd_signal: this.calculateMACD(prices).signal,
      macd_histogram: this.calculateMACD(prices).histogram,
      
      // Momentum Indicators
      rsi_14: this.calculateRSI(prices, 14),
      stoch_k: this.calculateStochastic(prices).k,
      stoch_d: this.calculateStochastic(prices).d,
      williams_r: this.calculateWilliamsR(prices, 14),
      
      // Volatility Indicators
      bollinger_upper: this.calculateBollingerBands(prices).upper,
      bollinger_middle: this.calculateBollingerBands(prices).middle,
      bollinger_lower: this.calculateBollingerBands(prices).lower,
      atr: this.calculateATR(prices, 14),
      
      // Volume Indicators
      volume_sma: this.calculateSMA(volumes, 20),
      volume_ratio: volumes[volumes.length - 1] / this.calculateSMA(volumes, 20),
      
      // Market Structure
      support_level: this.findSupportLevel(prices),
      resistance_level: this.findResistanceLevel(prices),
      trend_strength: this.calculateTrendStrength(prices)
    };
  }
  
  getMarketContext(): MarketContext {
    const currentHour = new Date().getUTCHours();
    const atr = this.calculateATR(this.priceHistory, 14);
    const avgPrice = this.calculateSMA(this.priceHistory, 20);
    
    return {
      volatilityRegime: this.getVolatilityRegime(atr, avgPrice),
      trendDirection: this.getTrendDirection(),
      marketHour: this.getMarketHour(currentHour),
      newsImpact: 'LOW' // Placeholder - would integrate with news API
    };
  }
  
  private calculateSMA(data: number[], period: number): number {
    if (data.length < period) return 0;
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }
  
  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = this.calculateSMA(data.slice(0, period), period);
    
    for (let i = period; i < data.length; i++) {
      ema = (data[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  private calculateMACD(data: number[]) {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([...Array(9).fill(0), macd], 9);
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }
  
  private calculateRSI(data: number[], period: number): number {
    if (data.length < period + 1) return 50;
    
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
    if (data.length < 14) return { k: 50, d: 50 };
    
    const period = 14;
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
    const period = 20;
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
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private findSupportLevel(data: number[]): number {
    // Simplified support level calculation
    const recentLows = data.slice(-20);
    return Math.min(...recentLows);
  }
  
  private findResistanceLevel(data: number[]): number {
    // Simplified resistance level calculation
    const recentHighs = data.slice(-20);
    return Math.max(...recentHighs);
  }
  
  private calculateTrendStrength(data: number[]): number {
    if (data.length < 20) return 0;
    
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const diff = Math.abs(ema12 - ema26);
    const avgPrice = this.calculateSMA(data, 20);
    
    return (diff / avgPrice) * 100;
  }
  
  private getVolatilityRegime(atr: number, avgPrice: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const volatilityPercent = (atr / avgPrice) * 100;
    
    if (volatilityPercent < 0.5) return 'LOW';
    if (volatilityPercent < 1.5) return 'MEDIUM';
    return 'HIGH';
  }
  
  private getTrendDirection(): 'BULLISH' | 'BEARISH' | 'SIDEWAYS' {
    if (this.priceHistory.length < 20) return 'SIDEWAYS';
    
    const ema12 = this.calculateEMA(this.priceHistory, 12);
    const ema26 = this.calculateEMA(this.priceHistory, 26);
    const diff = ((ema12 - ema26) / ema26) * 100;
    
    if (diff > 0.1) return 'BULLISH';
    if (diff < -0.1) return 'BEARISH';
    return 'SIDEWAYS';
  }
  
  private getMarketHour(hour: number): 'LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP' | 'LOW_LIQUIDITY' {
    if (hour >= 8 && hour <= 16) return 'LONDON';
    if (hour >= 13 && hour <= 21) return 'NEW_YORK';
    if ((hour >= 22 && hour <= 23) || (hour >= 0 && hour <= 7)) return 'ASIA';
    if (hour >= 13 && hour <= 16) return 'OVERLAP';
    return 'LOW_LIQUIDITY';
  }
}
