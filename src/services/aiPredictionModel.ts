import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';

export interface PredictionInput {
  indicators: AdvancedIndicators;
  marketContext: MarketContext;
  orderBookImbalance: number;
  recentPriceMovement: number[];
  timeOfDay: number;
  dayOfWeek: number;
}

export interface PredictionOutput {
  probability: number; // 0-1 probability of profit
  confidence: number; // 0-1 confidence in prediction
  expectedReturn: number; // Expected % return
  timeHorizon: number; // Seconds to hold position
  riskScore: number; // 0-1 risk assessment
  features: {
    technical: number;
    momentum: number;
    volatility: number;
    market_structure: number;
  };
}

export interface TradeOutcome {
  entryPrice: number;
  exitPrice: number;
  profitLoss: number;
  holdingTime: number;
  prediction: PredictionOutput;
  actualReturn: number;
  success: boolean;
}

export class AIPredictionModel {
  private trainingData: TradeOutcome[] = [];
  private modelWeights: { [key: string]: number } = {
    'technical': 0.35,
    'momentum': 0.25,
    'volatility_regime': 0.15,
    'market_structure': 0.20,
    'imbalance': 0.05,
  };
  
  private performanceMetrics = {
    accuracy: 0.5,
    precision: 0.5,
    recall: 0.5,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0.5
  };
  
  private adaptiveThresholds = {
    minProbability: 0.52,
    minConfidence: 0.45,
    maxRiskScore: 0.75
  };
  
  predict(input: PredictionInput): PredictionOutput {
    const features = this.extractFeatures(input);
    const rawScore = this.calculateRawScore(features);
    const probability = this.sigmoidActivation(rawScore);
    
    const confidence = this.calculateConfidence(features, input.marketContext);
    const expectedReturn = this.estimateExpectedReturn(probability, confidence, input.indicators, input.marketContext);
    const timeHorizon = this.estimateTimeHorizon(input.marketContext, input.indicators);
    const riskScore = this.calculateRiskScore(input);
    
    console.log(`[AI Model] Enhanced Features - Technical: ${features.technical.toFixed(3)}, Momentum: ${features.momentum.toFixed(3)}, Market Structure: ${features.market_structure.toFixed(3)}`);
    console.log(`[AI Model] Raw score: ${rawScore.toFixed(3)}, Probability: ${probability.toFixed(3)}, Expected return: ${expectedReturn.toFixed(3)}%`);
    
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
        market_structure: features.market_structure
      }
    };
  }
  
  updateModel(outcome: TradeOutcome) {
    this.trainingData.push(outcome);
    
    // Keep only last 500 trades for faster learning
    if (this.trainingData.length > 500) {
      this.trainingData = this.trainingData.slice(-500);
    }
    
    this.updatePerformanceMetrics();
    this.adaptThresholds();
    
    // Retrain model every 3 trades for rapid adaptation
    if (this.trainingData.length % 3 === 0) {
      this.retrainModel();
    }
  }
  
  getModelPerformance() {
    return {
      ...this.performanceMetrics,
      totalSamples: this.trainingData.length,
      lastUpdated: new Date().toISOString(),
      adaptiveThresholds: this.adaptiveThresholds
    };
  }
  
  getAdaptiveThresholds() {
    return { ...this.adaptiveThresholds };
  }
  
  private extractFeatures(input: PredictionInput) {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement } = input;
    
    // Enhanced technical features with better normalization
    const rsiSignal = this.normalizeRSI(indicators.rsi_14);
    const macdSignal = Math.tanh(indicators.macd_histogram * 50); // Increased sensitivity
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 30, 1); // More responsive
    
    // Enhanced momentum features
    const priceMomentum = this.calculatePriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 5); // Higher sensitivity
    const macdMomentum = indicators.macd > indicators.macd_signal ? 0.3 : -0.3;
    
    // Enhanced volatility features
    const volatilityScore = this.getVolatilityScore(marketContext.volatilityRegime);
    const atrNormalized = indicators.bollinger_middle > 0 ? 
      Math.min(indicators.atr / indicators.bollinger_middle, 0.05) * 20 : 0;
    const bollingerWidth = this.calculateBollingerWidth(indicators);
    
    // Enhanced market structure features
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    const marketRegimeScore = this.getMarketRegimeScore(marketContext.marketRegime);
    const timeOfDayScore = this.getTimeOfDayScore(input.timeOfDay);
    
    return {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum + macdMomentum) / 3,
      volatility: (volatilityScore + atrNormalized + bollingerWidth) / 3,
      market_structure: (supportResistanceStrength + marketHourScore + marketRegimeScore + timeOfDayScore) / 4,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 15) // Higher sensitivity
    };
  }
  
  private calculateRawScore(features: any): number {
    let score = 0;
    
    score += features.technical * this.modelWeights['technical'];
    score += features.momentum * this.modelWeights['momentum'];
    score += features.volatility * this.modelWeights['volatility_regime'];
    score += features.market_structure * this.modelWeights['market_structure'];
    score += features.orderbook_imbalance * this.modelWeights['imbalance'];
    
    // Dynamic bias based on recent performance
    const recentWinRate = this.getRecentWinRate();
    const performanceBias = (recentWinRate - 0.5) * 0.2; // Adjust based on recent performance
    score += performanceBias;
    
    return score;
  }
  
  private sigmoidActivation(x: number): number {
    return 1 / (1 + Math.exp(-x * 1.5)); // Steeper curve for better separation
  }
  
  private calculateConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.6; // Higher base confidence

    // Market regime adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            confidence += 0.2;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            confidence += 0.05;
            break;
        case 'SIDEWAYS_VOLATILE':
            confidence -= 0.1;
            break;
        case 'SIDEWAYS_QUIET':
            confidence -= 0.15;
            break;
    }
    
    // Volatility adjustments
    if (marketContext.volatilityRegime === 'HIGH') {
      confidence -= 0.05; // Less penalty for high volatility
    } else if (marketContext.volatilityRegime === 'LOW') {
      confidence += 0.1;
    }
    
    // Technical signal strength
    const technicalStrength = Math.abs(features.technical);
    if (technicalStrength > 0.7) {
      confidence += 0.15;
    } else if (technicalStrength > 0.5) {
      confidence += 0.1;
    }
    
    // Momentum confirmation
    if (Math.abs(features.momentum) > 0.6) {
      confidence += 0.1;
    }
    
    return Math.max(0.35, Math.min(0.95, confidence));
  }
  
  private estimateExpectedReturn(probability: number, confidence: number, indicators: AdvancedIndicators, marketContext: MarketContext): number {
    if (indicators.bollinger_middle <= 0) {
        console.warn(`[AI Model] Invalid bollinger_middle value: ${indicators.bollinger_middle}`);
        return 0.1; // Minimum expected return
    }

    // Base potential return from Bollinger Bands
    const bandRange = indicators.bollinger_upper - indicators.bollinger_lower;
    const potentialReturnPercent = (bandRange / indicators.bollinger_middle) * 100;
    
    // Market regime multiplier
    let regimeMultiplier = 1.0;
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            regimeMultiplier = 1.3;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            regimeMultiplier = 1.1;
            break;
        case 'SIDEWAYS_VOLATILE':
            regimeMultiplier = 0.8;
            break;
        case 'SIDEWAYS_QUIET':
            regimeMultiplier = 0.6;
            break;
    }
    
    // Volatility adjustment
    const volatilityMultiplier = marketContext.volatilityRegime === 'HIGH' ? 1.2 : 
                                marketContext.volatilityRegime === 'LOW' ? 0.8 : 1.0;
    
    // Calculate expected return
    const baseReturn = potentialReturnPercent * 0.3; // Target 30% of potential range
    const adjustedReturn = baseReturn * regimeMultiplier * volatilityMultiplier;
    const finalReturn = adjustedReturn * confidence * Math.abs(probability - 0.5) * 4;
    
    const result = Math.max(0.05, Math.min(2.0, finalReturn)); // Between 0.05% and 2%
    
    console.log(`[AI Model] Expected Return Details: base=${baseReturn.toFixed(3)}%, regime=${regimeMultiplier}, volatility=${volatilityMultiplier}, final=${result.toFixed(3)}%`);
    
    return result;
  }
  
  private estimateTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 75; // Optimized base time
    
    // Market regime adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            baseTime *= 0.8; // Faster in trending markets
            break;
        case 'SIDEWAYS_VOLATILE':
            baseTime *= 1.3; // Longer in choppy markets
            break;
        case 'SIDEWAYS_QUIET':
            baseTime *= 1.5; // Much longer in quiet markets
            break;
    }
    
    // Volatility adjustments
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.7;
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 1.4;
    }
    
    // Trend strength adjustment
    baseTime *= (1 + indicators.trend_strength / 300);
    
    return Math.max(30, Math.min(200, baseTime)); // 30 seconds to 3.3 minutes
  }
  
  private calculateRiskScore(input: PredictionInput): number {
    let risk = 0.35; // Lower base risk

    // Market regime risk adjustments
    switch (input.marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            risk -= 0.1;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            risk -= 0.05;
            break;
        case 'SIDEWAYS_VOLATILE':
            risk += 0.25;
            break;
        case 'SIDEWAYS_QUIET':
            risk += 0.1;
            break;
    }
    
    // Volatility risk
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.15;
    } else if (input.marketContext.volatilityRegime === 'LOW') {
      risk -= 0.05;
    }
    
    // RSI extremes (reduced penalty)
    if (input.indicators.rsi_14 < 30 || input.indicators.rsi_14 > 70) {
      risk += 0.1;
    }
    
    // Order book imbalance risk
    if (Math.abs(input.orderBookImbalance) > 0.5) {
      risk += 0.05;
    }
    
    return Math.max(0.1, Math.min(0.8, risk));
  }
  
  private adaptThresholds() {
    if (this.trainingData.length < 10) return;
    
    const recentTrades = this.trainingData.slice(-20);
    const winRate = recentTrades.filter(t => t.success).length / recentTrades.length;
    
    // Adapt probability threshold based on performance
    if (winRate > 0.6) {
      this.adaptiveThresholds.minProbability = Math.min(0.58, this.adaptiveThresholds.minProbability + 0.01);
    } else if (winRate < 0.4) {
      this.adaptiveThresholds.minProbability = Math.max(0.51, this.adaptiveThresholds.minProbability - 0.01);
    }
    
    // Adapt confidence threshold
    if (winRate > 0.65) {
      this.adaptiveThresholds.minConfidence = Math.min(0.55, this.adaptiveThresholds.minConfidence + 0.01);
    } else if (winRate < 0.35) {
      this.adaptiveThresholds.minConfidence = Math.max(0.35, this.adaptiveThresholds.minConfidence - 0.01);
    }
    
    // Adapt risk threshold
    const avgRisk = recentTrades.reduce((sum, t) => sum + t.prediction.riskScore, 0) / recentTrades.length;
    if (winRate > 0.6 && avgRisk < 0.5) {
      this.adaptiveThresholds.maxRiskScore = Math.min(0.8, this.adaptiveThresholds.maxRiskScore + 0.02);
    } else if (winRate < 0.4) {
      this.adaptiveThresholds.maxRiskScore = Math.max(0.6, this.adaptiveThresholds.maxRiskScore - 0.02);
    }
    
    console.log(`[AI Model] Adaptive thresholds updated: prob=${this.adaptiveThresholds.minProbability.toFixed(3)}, conf=${this.adaptiveThresholds.minConfidence.toFixed(3)}, risk=${this.adaptiveThresholds.maxRiskScore.toFixed(3)}`);
  }
  
  private retrainModel() {
    if (this.trainingData.length < 15) return;
    
    const recentTrades = this.trainingData.slice(-30);
    const learningRate = 0.03; // Higher learning rate
    
    // Calculate feature importance based on successful trades
    const successfulTrades = recentTrades.filter(t => t.success);
    const failedTrades = recentTrades.filter(t => !t.success);
    
    if (successfulTrades.length > 0 && failedTrades.length > 0) {
      // Adjust weights based on feature performance
      const successFeatures = this.analyzeFeaturePerformance(successfulTrades);
      const failFeatures = this.analyzeFeaturePerformance(failedTrades);
      
      Object.keys(this.modelWeights).forEach(key => {
        const successAvg = successFeatures[key] || 0;
        const failAvg = failFeatures[key] || 0;
        const importance = Math.abs(successAvg - failAvg);
        
        // Adjust weights based on discriminative power
        if (importance > 0.2) {
          this.modelWeights[key] *= (1 + learningRate);
        } else if (importance < 0.1) {
          this.modelWeights[key] *= (1 - learningRate * 0.5);
        }
        
        // Keep weights normalized
        this.modelWeights[key] = Math.max(0.05, Math.min(0.5, this.modelWeights[key]));
      });
      
      // Normalize weights
      const totalWeight = Object.values(this.modelWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key] /= totalWeight;
      });
    }
    
    console.log(`[AI Model] Model retrained with ${recentTrades.length} samples, Win rate: ${this.performanceMetrics.winRate.toFixed(3)}`);
  }
  
  private analyzeFeaturePerformance(trades: TradeOutcome[]): { [key: string]: number } {
    const features: { [key: string]: number } = {};
    
    trades.forEach(trade => {
      features['technical'] = (features['technical'] || 0) + trade.prediction.features.technical;
      features['momentum'] = (features['momentum'] || 0) + trade.prediction.features.momentum;
      features['volatility_regime'] = (features['volatility_regime'] || 0) + trade.prediction.features.volatility;
      features['market_structure'] = (features['market_structure'] || 0) + trade.prediction.features.market_structure;
    });
    
    // Average the features
    Object.keys(features).forEach(key => {
      features[key] /= trades.length;
    });
    
    return features;
  }
  
  private updatePerformanceMetrics() {
    if (this.trainingData.length === 0) return;
    
    const recentTrades = this.trainingData.slice(-50);
    const successfulTrades = recentTrades.filter(t => t.success);
    
    this.performanceMetrics.winRate = successfulTrades.length / recentTrades.length;
    this.performanceMetrics.totalTrades = this.trainingData.length;
    
    // Enhanced performance calculations
    const returns = recentTrades.map(t => t.actualReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    this.performanceMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningReturn = 0;
    
    recentTrades.forEach(trade => {
      runningReturn += trade.actualReturn;
      peak = Math.max(peak, runningReturn);
      const drawdown = peak > 0 ? (peak - runningReturn) / peak : 0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });
    
    this.performanceMetrics.maxDrawdown = maxDrawdown;
  }
  
  private getRecentWinRate(): number {
    if (this.trainingData.length < 5) return 0.5;
    const recent = this.trainingData.slice(-10);
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
    return Math.max(-1, Math.min(1, position * 2)); // Enhanced range
  }
  
  private calculateBollingerWidth(indicators: AdvancedIndicators): number {
    if (indicators.bollinger_middle <= 0) return 0;
    const width = (indicators.bollinger_upper - indicators.bollinger_lower) / indicators.bollinger_middle;
    return Math.min(width * 10, 1); // Normalize to 0-1 range
  }
  
  private calculatePriceMomentum(recentPrices: number[]): number {
    if (recentPrices.length < 2) return 0;
    
    const momentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    return Math.tanh(momentum * 500); // Higher sensitivity
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
    return Math.min(range / currentPrice, 0.05) * 20; // Enhanced calculation
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
