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
  vwap: number;
  
  // Market Structure
  support_level: number;
  resistance_level: number;
  trend_strength: number;
  orderbook_pressure: number;
}

export interface MarketContext {
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH';
  marketRegime: 'STRONG_BULL' | 'WEAK_BULL' | 'STRONG_BEAR' | 'WEAK_BEAR' | 'SIDEWAYS_VOLATILE' | 'SIDEWAYS_QUIET';
  marketHour: 'LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP' | 'LOW_LIQUIDITY';
  newsImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  liquidityScore: number;
  spreadQuality: number;
}

export interface OHLCData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export class AdvancedTechnicalAnalysis {
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  private ohlcData: OHLCData[] = [];
  private macdHistory: number[] = [];
  private macdSignalHistory: number[] = [];
  
  updatePriceData(price: number, volume: number = 1000) {
    this.priceHistory.push(price);
    this.volumeHistory.push(volume);
    
    // Create OHLC data from price updates
    const currentTime = Date.now();
    const lastOHLC = this.ohlcData[this.ohlcData.length - 1];
    
    // Group by minute intervals for OHLC
    const currentMinute = Math.floor(currentTime / 60000) * 60000;
    
    if (!lastOHLC || lastOHLC.timestamp < currentMinute) {
      // New minute, create new OHLC bar
      this.ohlcData.push({
        open: price,
        high: price,
        low: price,
        close: price,
        volume: volume,
        timestamp: currentMinute
      });
    } else {
      // Update current minute bar
      lastOHLC.high = Math.max(lastOHLC.high, price);
      lastOHLC.low = Math.min(lastOHLC.low, price);
      lastOHLC.close = price;
      lastOHLC.volume += volume;
    }
    
    // Keep only last 200 periods for performance
    if (this.priceHistory.length > 200) {
      this.priceHistory = this.priceHistory.slice(-200);
      this.volumeHistory = this.volumeHistory.slice(-200);
      this.ohlcData = this.ohlcData.slice(-200);
    }
  }
  
  public getPriceHistory(): number[] {
    return [...this.priceHistory];
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
    
    console.log(`[Technical Analysis] Calculating enhanced indicators with ${prices.length} price points`);
    
    const macd = this.calculateEnhancedMACD(prices);
    
    return {
      // Trend Indicators
      sma_9: this.calculateSMA(prices, 9),
      sma_21: this.calculateSMA(prices, Math.min(21, prices.length)),
      ema_12: this.calculateEMA(prices, 12),
      ema_26: this.calculateEMA(prices, Math.min(26, prices.length)),
      macd: macd.macd,
      macd_signal: macd.signal,
      macd_histogram: macd.histogram,
      
      // Momentum Indicators
      rsi_14: this.calculateRSI(prices, Math.min(14, prices.length - 1)),
      stoch_k: this.calculateEnhancedStochastic().k,
      stoch_d: this.calculateEnhancedStochastic().d,
      williams_r: this.calculateWilliamsR(prices, Math.min(14, prices.length)),
      
      // Volatility Indicators
      bollinger_upper: this.calculateBollingerBands(prices).upper,
      bollinger_middle: this.calculateBollingerBands(prices).middle,
      bollinger_lower: this.calculateBollingerBands(prices).lower,
      atr: this.calculateEnhancedATR(Math.min(14, this.ohlcData.length - 1)),
      
      // Volume Indicators
      volume_sma: this.calculateSMA(volumes, Math.min(20, volumes.length)),
      volume_ratio: volumes.length > 0 ? volumes[volumes.length - 1] / this.calculateSMA(volumes, Math.min(20, volumes.length)) : 1,
      vwap: this.calculateVWAP(),
      
      // Market Structure
      support_level: this.findSupportLevel(prices),
      resistance_level: this.findResistanceLevel(prices),
      trend_strength: this.calculateTrendStrength(prices),
      orderbook_pressure: this.calculateOrderBookPressure()
    };
  }
  
  getMarketContext(): MarketContext {
    const currentHour = new Date().getUTCHours();
    const atr = this.ohlcData.length > 14 ? this.calculateEnhancedATR(14) : 0;
    const avgPrice = this.priceHistory.length > 0 ? this.calculateSMA(this.priceHistory, Math.min(20, this.priceHistory.length)) : 0;
    
    return {
      volatilityRegime: this.getVolatilityRegime(atr, avgPrice),
      marketRegime: this.getMarketRegime(),
      marketHour: this.getMarketHour(currentHour),
      newsImpact: 'LOW',
      liquidityScore: this.calculateLiquidityScore(),
      spreadQuality: this.calculateSpreadQuality()
    };
  }
  
  // Enhanced MACD calculation with proper EMA-based signal line
  private calculateEnhancedMACD(data: number[]) {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, Math.min(26, data.length));
    const macd = ema12 - ema26;
    
    // Store MACD history for signal calculation
    this.macdHistory.push(macd);
    if (this.macdHistory.length > 50) {
      this.macdHistory = this.macdHistory.slice(-50);
    }
    
    // Calculate signal line as EMA(9) of MACD
    let signal: number;
    if (this.macdHistory.length >= 9) {
      signal = this.calculateEMA(this.macdHistory, 9);
    } else {
      // Use simple average for initial periods
      signal = this.macdHistory.reduce((sum, val) => sum + val, 0) / this.macdHistory.length;
    }
    
    const histogram = macd - signal;
    
    console.log(`[MACD] Enhanced calculation - MACD: ${macd.toFixed(4)}, Signal: ${signal.toFixed(4)}, Histogram: ${histogram.toFixed(4)}`);
    
    return { macd, signal, histogram };
  }
  
  // Enhanced Stochastic with proper OHLC handling
  private calculateEnhancedStochastic() {
    const period = Math.min(14, this.ohlcData.length);
    if (period < 2) return { k: 50, d: 50 };
    
    const recentOHLC = this.ohlcData.slice(-period);
    const highs = recentOHLC.map(bar => bar.high);
    const lows = recentOHLC.map(bar => bar.low);
    const closes = recentOHLC.map(bar => bar.close);
    
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);
    const currentClose = closes[closes.length - 1];
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // Calculate %D as SMA of last 3 %K values
    // For now, simplified to current %K (would need %K history for proper implementation)
    const d = k; // In production, this would be SMA of %K values
    
    console.log(`[Stochastic] Enhanced calculation - %K: ${k.toFixed(2)}, %D: ${d.toFixed(2)}, HH: ${highestHigh}, LL: ${lowestLow}`);
    
    return { k, d };
  }
  
  // Enhanced ATR with proper true range calculation
  private calculateEnhancedATR(period: number): number {
    if (this.ohlcData.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < this.ohlcData.length; i++) {
      const current = this.ohlcData[i];
      const previous = this.ohlcData[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(tr1, tr2, tr3);
      trueRanges.push(trueRange);
    }
    
    const atr = this.calculateSMA(trueRanges.slice(-period), period);
    console.log(`[ATR] Enhanced calculation - ATR: ${atr.toFixed(4)} with ${trueRanges.length} true range values`);
    
    return atr;
  }
  
  // Calculate Volume Weighted Average Price
  private calculateVWAP(): number {
    if (this.ohlcData.length === 0) return 0;
    
    const recentData = this.ohlcData.slice(-20); // Last 20 periods
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    recentData.forEach(bar => {
      const typicalPrice = (bar.high + bar.low + bar.close) / 3;
      totalVolumePrice += typicalPrice * bar.volume;
      totalVolume += bar.volume;
    });
    
    const vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
    console.log(`[VWAP] Calculated: ${vwap.toFixed(4)} from ${recentData.length} periods`);
    
    return vwap;
  }
  
  // Calculate order book pressure indicator
  private calculateOrderBookPressure(): number {
    // This would integrate with actual order book data
    // For now, using volume-based approximation
    if (this.volumeHistory.length < 10) return 0;
    
    const recentVolumes = this.volumeHistory.slice(-10);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const currentVolume = this.volumeHistory[this.volumeHistory.length - 1];
    
    const pressure = currentVolume > avgVolume ? 
      Math.min((currentVolume / avgVolume - 1), 1) : 
      Math.max((currentVolume / avgVolume - 1), -1);
    
    return pressure;
  }
  
  // Calculate liquidity score
  private calculateLiquidityScore(): number {
    if (this.volumeHistory.length < 20) return 0.5;
    
    const recentVolumes = this.volumeHistory.slice(-20);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const volumeStdDev = this.calculateStandardDeviation(recentVolumes);
    
    // Higher average volume and lower volatility = better liquidity
    const volumeScore = Math.min(avgVolume / 10000, 1); // Normalize to 0-1
    const stabilityScore = volumeStdDev > 0 ? Math.max(0, 1 - (volumeStdDev / avgVolume)) : 1;
    
    return (volumeScore + stabilityScore) / 2;
  }
  
  // Calculate spread quality
  private calculateSpreadQuality(): number {
    // This would use actual bid-ask spread data
    // For now, using volatility as proxy (lower volatility = better spreads)
    const atr = this.ohlcData.length > 14 ? this.calculateEnhancedATR(14) : 0;
    const avgPrice = this.priceHistory.length > 0 ? this.calculateSMA(this.priceHistory, Math.min(20, this.priceHistory.length)) : 1;
    
    const volatilityPercent = avgPrice > 0 ? (atr / avgPrice) * 100 : 0;
    return Math.max(0, Math.min(1, 1 - volatilityPercent / 2)); // Lower volatility = better spread quality
  }
  
  // ... keep existing code (SMA, EMA, RSI, WilliamsR, BollingerBands, StandardDeviation, etc.)
  
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
  
  private calculateStandardDeviation(data: number[]): number {
    if (data.length === 0) return 0;
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const squaredDiffs = data.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / data.length;
    return Math.sqrt(avgSquaredDiff);
  }
  
  private findSupportLevel(data: number[]): number {
    const recentLows = data.slice(-Math.min(20, data.length));
    return Math.min(...recentLows);
  }
  
  private findResistanceLevel(data: number[]): number {
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

// Create a singleton instance for the advanced technical analysis
const technicalAnalysisInstance = new AdvancedTechnicalAnalysis();

// Export a function that uses the singleton instance
export const advancedTechnicalAnalysis = async (price: number, volume: number) => {
  technicalAnalysisInstance.updatePriceData(price, volume);
  const indicators = technicalAnalysisInstance.calculateAdvancedIndicators();
  
  if (!indicators) {
    // Return basic indicators structure when insufficient data
    return {
      sma_9: price,
      sma_21: price,
      ema_12: price,
      ema_26: price,
      macd: 0,
      macd_signal: 0,
      macd_histogram: 0,
      rsi_14: 50,
      stoch_k: 50,
      stoch_d: 50,
      williams_r: -50,
      bollinger_upper: price * 1.02,
      bollinger_middle: price,
      bollinger_lower: price * 0.98,
      atr: price * 0.01,
      volume_sma: volume,
      volume_ratio: 1,
      vwap: price,
      support_level: price * 0.98,
      resistance_level: price * 1.02,
      trend_strength: 0,
      orderbook_pressure: 0,
      rsi: 50 // Legacy support
    };
  }
  
  return {
    ...indicators,
    rsi: indicators.rsi_14 // Legacy support
  };
};

export { AdvancedTechnicalAnalysis };
