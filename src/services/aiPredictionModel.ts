import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';

export interface PredictionInput {
  indicators: AdvancedIndicators;
  marketContext: MarketContext;
  orderBookImbalance: number;
  recentPriceMovement: number[];
  timeOfDay: number;
  dayOfWeek: number;
  deepOrderBookData?: {
    bidDepth: number[];
    askDepth: number[];
    weightedMidPrice: number;
  };
}

export interface PredictionOutput {
  probability: number;
  confidence: number;
  expectedReturn: number;
  timeHorizon: number;
  riskScore: number;
  features: {
    technical: number;
    momentum: number;
    volatility: number;
    market_structure: number;
    orderbook_depth: number;
  };
  kellyFraction: number;
  maxAdverseExcursion: number;
}

export interface TradeOutcome {
  entryPrice: number;
  exitPrice: number;
  profitLoss: number;
  holdingTime: number;
  prediction: PredictionOutput;
  actualReturn: number;
  success: boolean;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
}

export class AIPredictionModel {
  private trainingData: TradeOutcome[] = [];
  private modelWeights: { [key: string]: number } = {
    'technical': 0.30,
    'momentum': 0.25,
    'volatility_regime': 0.15,
    'market_structure': 0.20,
    'orderbook_depth': 0.10,
  };
  
  private performanceMetrics = {
    accuracy: 0.5,
    precision: 0.5,
    recall: 0.5,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0.5,
    avgMAE: 0,
    avgMFE: 0,
    profitFactor: 1.0
  };
  
  private adaptiveThresholds = {
    minProbability: 0.52,
    minConfidence: 0.45,
    maxRiskScore: 0.70,
    kellyThreshold: 0.1
  };
  
  predict(input: PredictionInput): PredictionOutput {
    const features = this.extractEnhancedFeatures(input);
    const rawScore = this.calculateRawScore(features);
    const probability = this.sigmoidActivation(rawScore);
    
    const confidence = this.calculateEnhancedConfidence(features, input.marketContext);
    const expectedReturn = this.estimateExpectedReturn(probability, confidence, input.indicators, input.marketContext);
    const timeHorizon = this.estimateOptimalTimeHorizon(input.marketContext, input.indicators);
    const riskScore = this.calculateEnhancedRiskScore(input);
    const kellyFraction = this.calculateKellyFraction(probability, expectedReturn);
    const maxAdverseExcursion = this.estimateMAE(input.indicators, input.marketContext);
    
    console.log(`[AI Model] Enhanced prediction - Prob: ${probability.toFixed(3)}, Kelly: ${kellyFraction.toFixed(3)}, MAE: ${maxAdverseExcursion.toFixed(3)}%`);
    
    return {
      probability,
      confidence,
      expectedReturn,
      timeHorizon,
      riskScore,
      features: {
        technical: features.technical,
        momentum: features.momentum,
        volatility: features.volatility,
        market_structure: features.market_structure,
        orderbook_depth: features.orderbook_depth
      },
      kellyFraction,
      maxAdverseExcursion
    };
  }
  
  updateModel(outcome: TradeOutcome) {
    this.trainingData.push(outcome);
    
    if (this.trainingData.length > 500) {
      this.trainingData = this.trainingData.slice(-500);
    }
    
    this.updateEnhancedPerformanceMetrics();
    this.adaptThresholdsBasedOnPerformance();
    
    // More frequent retraining for faster adaptation
    if (this.trainingData.length % 2 === 0) {
      this.retrainModelWithRegimeAwareness();
    }
    
    // Update Kelly Criterion threshold based on recent performance
    this.updateKellyThreshold();
  }
  
  getModelPerformance() {
    return {
      ...this.performanceMetrics,
      totalSamples: this.trainingData.length,
      lastUpdated: new Date().toISOString(),
      adaptiveThresholds: this.adaptiveThresholds,
      recentTrades: this.trainingData.slice(-10)
    };
  }
  
  getAdaptiveThresholds() {
    return { ...this.adaptiveThresholds };
  }
  
  // Enhanced feature extraction with optimized sensitivity
  private extractEnhancedFeatures(input: PredictionInput) {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement, deepOrderBookData } = input;
    
    // Technical features with adaptive scaling
    const rsiSignal = this.normalizeRSIAdaptive(indicators.rsi_14, marketContext.volatilityRegime);
    const macdSignal = Math.tanh(indicators.macd_histogram * this.getAdaptiveScaling(marketContext)); // Reduced from 50x
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 25, 1); // More responsive
    
    // Enhanced momentum with VWAP
    const priceMomentum = this.calculatePriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 3); // Reduced sensitivity
    const vwapSignal = this.calculateVWAPSignal(indicators);
    const macdMomentum = indicators.macd > indicators.macd_signal ? 0.25 : -0.25;
    
    // Volatility features with regime awareness
    const volatilityScore = this.getVolatilityScore(marketContext.volatilityRegime);
    const atrNormalized = indicators.bollinger_middle > 0 ? 
      Math.min(indicators.atr / indicators.bollinger_middle, 0.04) * 25 : 0;
    const bollingerWidth = this.calculateBollingerWidth(indicators);
    
    // Enhanced market structure
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    const marketRegimeScore = this.getMarketRegimeScore(marketContext.marketRegime);
    const liquidityScore = marketContext.liquidityScore;
    
    // Deep order book analysis
    const orderbookDepthScore = this.calculateOrderbookDepth(deepOrderBookData, orderBookImbalance);
    
    return {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum + vwapSignal + macdMomentum) / 4,
      volatility: (volatilityScore + atrNormalized + bollingerWidth) / 3,
      market_structure: (supportResistanceStrength + marketHourScore + marketRegimeScore + liquidityScore) / 4,
      orderbook_depth: orderbookDepthScore,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 10) // Reduced from 15
    };
  }
  
  // Adaptive scaling based on market conditions
  private getAdaptiveScaling(marketContext: MarketContext): number {
    let baseScaling = 10; // Reduced from 50
    
    switch (marketContext.volatilityRegime) {
      case 'HIGH':
        return baseScaling * 0.7; // Reduce sensitivity in high volatility
      case 'LOW':
        return baseScaling * 1.3; // Increase sensitivity in low volatility
      default:
        return baseScaling;
    }
  }
  
  // Enhanced RSI normalization with volatility awareness
  private normalizeRSIAdaptive(rsi: number, volatilityRegime: string): number {
    let overboughtLevel = 70;
    let oversoldLevel = 30;
    
    // Adjust levels based on volatility
    if (volatilityRegime === 'HIGH') {
      overboughtLevel = 75;
      oversoldLevel = 25;
    } else if (volatilityRegime === 'LOW') {
      overboughtLevel = 65;
      oversoldLevel = 35;
    }
    
    if (rsi > overboughtLevel) return (rsi - overboughtLevel) / (100 - overboughtLevel);
    if (rsi < oversoldLevel) return (oversoldLevel - rsi) / oversoldLevel;
    return (rsi - 50) / 50;
  }
  
  // VWAP-based signal
  private calculateVWAPSignal(indicators: AdvancedIndicators): number {
    if (indicators.vwap === 0 || indicators.bollinger_middle === 0) return 0;
    
    const priceVsVWAP = (indicators.bollinger_middle - indicators.vwap) / indicators.vwap;
    return Math.tanh(priceVsVWAP * 100); // Price relative to VWAP
  }
  
  // Enhanced order book depth analysis
  private calculateOrderbookDepth(deepData: any, imbalance: number): number {
    if (!deepData) {
      // Fallback to basic imbalance
      return Math.tanh(imbalance * 8);
    }
    
    const { bidDepth, askDepth, weightedMidPrice } = deepData;
    
    // Calculate depth-weighted imbalance
    const totalBidDepth = bidDepth.reduce((sum, depth) => sum + depth, 0);
    const totalAskDepth = askDepth.reduce((sum, depth) => sum + depth, 0);
    const depthImbalance = (totalBidDepth - totalAskDepth) / (totalBidDepth + totalAskDepth);
    
    // Combine with price-weighted signal
    const depthScore = Math.tanh(depthImbalance * 5);
    const imbalanceScore = Math.tanh(imbalance * 8);
    
    return (depthScore + imbalanceScore) / 2;
  }
  
  // Kelly Criterion calculation
  private calculateKellyFraction(probability: number, expectedReturn: number): number {
    const winProbability = probability;
    const lossProbability = 1 - probability;
    const avgWin = Math.abs(expectedReturn);
    const avgLoss = Math.abs(expectedReturn) * 0.5; // Assume 2:1 reward-risk ratio
    
    if (avgLoss === 0) return 0;
    
    const kellyFraction = (winProbability * avgWin - lossProbability * avgLoss) / avgWin;
    return Math.max(0, Math.min(0.25, kellyFraction)); // Cap at 25%
  }
  
  // Estimate Maximum Adverse Excursion
  private estimateMAE(indicators: AdvancedIndicators, marketContext: MarketContext): number {
    let baseMAE = 0.5; // 0.5% base expectation
    
    // Adjust based on volatility
    const atrPercent = indicators.bollinger_middle > 0 ? 
      (indicators.atr / indicators.bollinger_middle) * 100 : 0.5;
    
    baseMAE = Math.max(0.3, Math.min(2.0, atrPercent * 0.8));
    
    // Adjust for market regime
    switch (marketContext.marketRegime) {
      case 'SIDEWAYS_VOLATILE':
        baseMAE *= 1.5;
        break;
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        baseMAE *= 0.8;
        break;
    }
    
    return baseMAE;
  }
  
  // Enhanced confidence calculation
  private calculateEnhancedConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.6;

    // Market regime confidence adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            confidence += 0.15;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            confidence += 0.05;
            break;
        case 'SIDEWAYS_VOLATILE':
            confidence -= 0.15;
            break;
        case 'SIDEWAYS_QUIET':
            confidence -= 0.1;
            break;
    }
    
    // Liquidity and spread quality adjustments
    confidence += (marketContext.liquidityScore - 0.5) * 0.2;
    confidence += (marketContext.spreadQuality - 0.5) * 0.15;
    
    // Technical signal strength
    const technicalStrength = Math.abs(features.technical);
    if (technicalStrength > 0.7) {
      confidence += 0.12;
    } else if (technicalStrength > 0.5) {
      confidence += 0.08;
    }
    
    // Order book depth confidence
    if (Math.abs(features.orderbook_depth) > 0.6) {
      confidence += 0.1;
    }
    
    return Math.max(0.3, Math.min(0.9, confidence));
  }
  
  // Enhanced performance metrics calculation
  private updateEnhancedPerformanceMetrics() {
    if (this.trainingData.length === 0) return;
    
    const recentTrades = this.trainingData.slice(-50);
    const successfulTrades = recentTrades.filter(t => t.success);
    
    this.performanceMetrics.winRate = successfulTrades.length / recentTrades.length;
    this.performanceMetrics.totalTrades = this.trainingData.length;
    
    // Calculate enhanced metrics
    const returns = recentTrades.map(t => t.actualReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    this.performanceMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    // MAE and MFE tracking
    this.performanceMetrics.avgMAE = recentTrades.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / recentTrades.length;
    this.performanceMetrics.avgMFE = recentTrades.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / recentTrades.length;
    
    // Profit factor
    const grossProfit = recentTrades.filter(t => t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    const grossLoss = recentTrades.filter(t => !t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    this.performanceMetrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1.0;
    
    console.log(`[AI Model] Enhanced metrics - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}, Avg MAE: ${this.performanceMetrics.avgMAE.toFixed(3)}%`);
  }
  
  // Update Kelly threshold based on performance
  private updateKellyThreshold() {
    if (this.trainingData.length < 20) return;
    
    const recentWinRate = this.getRecentWinRate();
    const profitFactor = this.performanceMetrics.profitFactor;
    
    // Adjust Kelly threshold based on performance
    if (recentWinRate > 0.65 && profitFactor > 1.3) {
      this.adaptiveThresholds.kellyThreshold = Math.min(0.2, this.adaptiveThresholds.kellyThreshold * 1.1);
    } else if (recentWinRate < 0.35 || profitFactor < 0.8) {
      this.adaptiveThresholds.kellyThreshold = Math.max(0.05, this.adaptiveThresholds.kellyThreshold * 0.9);
    }
  }
  
  private calculateRawScore(features: any): number {
    let score = 0;
    
    score += features.technical * this.modelWeights['technical'];
    score += features.momentum * this.modelWeights['momentum'];
    score += features.volatility * this.modelWeights['volatility_regime'];
    score += features.market_structure * this.modelWeights['market_structure'];
    score += features.orderbook_depth * this.modelWeights['orderbook_depth'];
    
    const recentWinRate = this.getRecentWinRate();
    const performanceBias = (recentWinRate - 0.5) * 0.15;
    score += performanceBias;
    
    return score;
  }
  
  private sigmoidActivation(x: number): number {
    return 1 / (1 + Math.exp(-x * 1.2));
  }
  
  private estimateExpectedReturn(probability: number, confidence: number, indicators: AdvancedIndicators, marketContext: MarketContext): number {
    if (indicators.bollinger_middle <= 0) {
        return 0.1;
    }

    const bandRange = indicators.bollinger_upper - indicators.bollinger_lower;
    const potentialReturnPercent = (bandRange / indicators.bollinger_middle) * 100;
    
    let regimeMultiplier = 1.0;
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            regimeMultiplier = 1.2;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            regimeMultiplier = 1.05;
            break;
        case 'SIDEWAYS_VOLATILE':
            regimeMultiplier = 0.85;
            break;
        case 'SIDEWAYS_QUIET':
            regimeMultiplier = 0.7;
            break;
    }
    
    const volatilityMultiplier = marketContext.volatilityRegime === 'HIGH' ? 1.1 : 
                                marketContext.volatilityRegime === 'LOW' ? 0.9 : 1.0;
    
    const liquidityMultiplier = 0.8 + (marketContext.liquidityScore * 0.4); // 0.8 to 1.2 range
    
    const baseReturn = potentialReturnPercent * 0.25;
    const adjustedReturn = baseReturn * regimeMultiplier * volatilityMultiplier * liquidityMultiplier;
    const finalReturn = adjustedReturn * confidence * Math.abs(probability - 0.5) * 4;
    
    return Math.max(0.05, Math.min(1.8, finalReturn));
  }
  
  private estimateOptimalTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 60; // Reduced base time for more active trading
    
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            baseTime *= 0.7;
            break;
        case 'SIDEWAYS_VOLATILE':
            baseTime *= 1.4;
            break;
        case 'SIDEWAYS_QUIET':
            baseTime *= 1.8;
            break;
    }
    
    // Adjust for liquidity
    baseTime *= (1.5 - marketContext.liquidityScore * 0.5); // Better liquidity = shorter holds
    
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.6;
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 1.3;
    }
    
    baseTime *= (1 + indicators.trend_strength / 400);
    
    return Math.max(20, Math.min(180, baseTime));
  }
  
  private calculateEnhancedRiskScore(input: PredictionInput): number {
    let risk = 0.3;

    switch (input.marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            risk -= 0.08;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            risk -= 0.03;
            break;
        case 'SIDEWAYS_VOLATILE':
            risk += 0.2;
            break;
        case 'SIDEWAYS_QUIET':
            risk += 0.08;
            break;
    }
    
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.12;
    } else if (input.marketContext.volatilityRegime === 'LOW') {
      risk -= 0.03;
    }
    
    // Liquidity and spread adjustments
    risk -= (input.marketContext.liquidityScore - 0.5) * 0.15;
    risk -= (input.marketContext.spreadQuality - 0.5) * 0.1;
    
    if (input.indicators.rsi_14 < 25 || input.indicators.rsi_14 > 75) {
      risk += 0.08;
    }
    
    if (Math.abs(input.orderBookImbalance) > 0.6) {
      risk += 0.05;
    }
    
    return Math.max(0.1, Math.min(0.75, risk));
  }
  
  private adaptThresholdsBasedOnPerformance() {
    if (this.trainingData.length < 15) return;
    
    const recentTrades = this.trainingData.slice(-25);
    const winRate = recentTrades.filter(t => t.success).length / recentTrades.length;
    const profitFactor = this.performanceMetrics.profitFactor;
    
    // More aggressive threshold adaptation
    if (winRate > 0.65 && profitFactor > 1.3) {
      this.adaptiveThresholds.minProbability = Math.min(0.58, this.adaptiveThresholds.minProbability + 0.01);
      this.adaptiveThresholds.minConfidence = Math.min(0.55, this.adaptiveThresholds.minConfidence + 0.01);
    } else if (winRate < 0.35 || profitFactor < 0.8) {
      this.adaptiveThresholds.minProbability = Math.max(0.50, this.adaptiveThresholds.minProbability - 0.015);
      this.adaptiveThresholds.minConfidence = Math.max(0.35, this.adaptiveThresholds.minConfidence - 0.015);
    }
    
    const avgRisk = recentTrades.reduce((sum, t) => sum + t.prediction.riskScore, 0) / recentTrades.length;
    if (winRate > 0.6 && avgRisk < 0.4) {
      this.adaptiveThresholds.maxRiskScore = Math.min(0.75, this.adaptiveThresholds.maxRiskScore + 0.025);
    } else if (winRate < 0.4) {
      this.adaptiveThresholds.maxRiskScore = Math.max(0.55, this.adaptiveThresholds.maxRiskScore - 0.025);
    }
  }
  
  private retrainModelWithRegimeAwareness() {
    if (this.trainingData.length < 20) return;
    
    const recentTrades = this.trainingData.slice(-40);
    const learningRate = 0.025;
    
    // Separate performance by market regime
    const regimePerformance = this.analyzeRegimePerformance(recentTrades);
    
    const successfulTrades = recentTrades.filter(t => t.success);
    const failedTrades = recentTrades.filter(t => !t.success);
    
    if (successfulTrades.length > 0 && failedTrades.length > 0) {
      const successFeatures = this.analyzeFeaturePerformance(successfulTrades);
      const failFeatures = this.analyzeFeaturePerformance(failedTrades);
      
      Object.keys(this.modelWeights).forEach(key => {
        const successAvg = successFeatures[key] || 0;
        const failAvg = failFeatures[key] || 0;
        const importance = Math.abs(successAvg - failAvg);
        
        if (importance > 0.25) {
          this.modelWeights[key] *= (1 + learningRate * 1.5);
        } else if (importance < 0.1) {
          this.modelWeights[key] *= (1 - learningRate * 0.7);
        }
        
        this.modelWeights[key] = Math.max(0.05, Math.min(0.45, this.modelWeights[key]));
      });
      
      const totalWeight = Object.values(this.modelWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key] /= totalWeight;
      });
    }
    
    console.log(`[AI Model] Enhanced retraining completed - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}`);
  }
  
  private analyzeRegimePerformance(trades: TradeOutcome[]) {
    // This would analyze performance by market regime
    // Implementation would track which regimes perform best
    return {};
  }
  
  private analyzeFeaturePerformance(trades: TradeOutcome[]): { [key: string]: number } {
    const features: { [key: string]: number } = {};
    
    trades.forEach(trade => {
      features['technical'] = (features['technical'] || 0) + trade.prediction.features.technical;
      features['momentum'] = (features['momentum'] || 0) + trade.prediction.features.momentum;
      features['volatility_regime'] = (features['volatility_regime'] || 0) + trade.prediction.features.volatility;
      features['market_structure'] = (features['market_structure'] || 0) + trade.prediction.features.market_structure;
      features['orderbook_depth'] = (features['orderbook_depth'] || 0) + trade.prediction.features.orderbook_depth;
    });
    
    Object.keys(features).forEach(key => {
      features[key] /= trades.length;
    });
    
    return features;
  }
  
  private getRecentWinRate(): number {
    if (this.trainingData.length < 5) return 0.5;
    const recent = this.trainingData.slice(-15);
    return recent.filter(t => t.success).length / recent.length;
  }
  
  // Enhanced helper methods
  private normalizeRSI(rsi: number): number {
    // More aggressive RSI normalization for better signals
    if (rsi > 70) return (rsi - 70) / 30; // 0 to 1 for overbought
    if (rsi < 30) return (30 - rsi) / 30; // 0 to 1 for oversold
    return (rsi - 50) / 50; // -1 to 1 for neutral
  }
  
  private calculateBollingerPosition(indicators: AdvancedIndicators): number {
    const range = indicators.bollinger_upper - indicators.bollinger_lower;
    if (range === 0) return 0;
    
    const currentPrice = indicators.bollinger_middle;
    const position = (currentPrice - indicators.bollinger_lower) / range - 0.5;
    return Math.max(-1, Math.min(1, position * 2));
  }
  
  private calculateBollingerWidth(indicators: AdvancedIndicators): number {
    if (indicators.bollinger_middle <= 0) return 0;
    const width = (indicators.bollinger_upper - indicators.bollinger_lower) / indicators.bollinger_middle;
    return Math.min(width * 10, 1);
  }
  
  private calculatePriceMomentum(recentPrices: number[]): number {
    if (recentPrices.length < 2) return 0;
    
    const momentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    return Math.tanh(momentum * 300);
  }
  
  private getVolatilityScore(regime: string): number {
    switch (regime) {
      case 'LOW': return 0.3;
      case 'MEDIUM': return 0.6;
      case 'HIGH': return 0.9;
      default: return 0.5;
    }
  }
  
  private calculateSRStrength(indicators: AdvancedIndicators): number {
    const range = indicators.resistance_level - indicators.support_level;
    const currentPrice = (indicators.support_level + indicators.resistance_level) / 2;
    if (currentPrice <= 0) return 0;
    return Math.min(range / currentPrice, 0.05) * 20;
  }
  
  private getMarketRegimeScore(regime: MarketContext['marketRegime']): number {
    switch (regime) {
      case 'STRONG_BULL': return 0.9;
      case 'WEAK_BULL': return 0.5;
      case 'STRONG_BEAR': return -0.9;
      case 'WEAK_BEAR': return -0.5;
      case 'SIDEWAYS_VOLATILE': return -0.3;
      case 'SIDEWAYS_QUIET': return 0.0;
      default: return 0;
    }
  }
  
  private getMarketHourScore(hour: string): number {
    switch (hour) {
      case 'OVERLAP': return 1.0;
      case 'NEW_YORK': return 0.9;
      case 'LONDON': return 0.8;
      case 'ASIA': return 0.7;
      case 'LOW_LIQUIDITY': return 0.4;
      default: return 0.5;
    }
  }
  
  private getTimeOfDayScore(hour: number): number {
    // Enhanced time scoring for different trading sessions
    if (hour >= 8 && hour <= 12) return 0.9; // European morning
    if (hour >= 13 && hour <= 17) return 1.0; // Overlap period
    if (hour >= 18 && hour <= 22) return 0.8; // US session
    if (hour >= 0 && hour <= 3) return 0.6; // Asian session
    return 0.3; // Low activity periods
  }
}
