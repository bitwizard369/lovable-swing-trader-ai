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
    // Technical indicators - increased weights for faster decisions
    'rsi_signal': 0.18,
    'macd_signal': 0.15,
    'bollinger_position': 0.12,
    'trend_strength': 0.10,
    
    // Market context
    'volatility_regime': 0.08,
    'market_hour': 0.06,
    'trend_direction': 0.10,
    
    // Order book
    'imbalance': 0.15,
    'spread': 0.03,
    
    // Momentum
    'price_momentum': 0.03
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
  
  predict(input: PredictionInput): PredictionOutput {
    const features = this.extractFeatures(input);
    const rawScore = this.calculateRawScore(features);
    const probability = this.sigmoidActivation(rawScore);
    
    const confidence = this.calculateConfidence(features, input.marketContext);
    const expectedReturn = this.estimateExpectedReturn(probability, input.indicators);
    const timeHorizon = this.estimateTimeHorizon(input.marketContext, input.indicators);
    const riskScore = this.calculateRiskScore(input);
    
    console.log(`[AI Model] Features - Technical: ${features.technical.toFixed(3)}, Momentum: ${features.momentum.toFixed(3)}, Raw score: ${rawScore.toFixed(3)}`);
    
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
    
    // Keep only last 1000 trades for training
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-1000);
    }
    
    // Update performance metrics
    this.updatePerformanceMetrics();
    
    // Retrain model every 5 trades instead of 10 for faster learning
    if (this.trainingData.length % 5 === 0) {
      this.retrainModel();
    }
  }
  
  getModelPerformance() {
    return {
      ...this.performanceMetrics,
      totalSamples: this.trainingData.length,
      lastUpdated: new Date().toISOString()
    };
  }
  
  private extractFeatures(input: PredictionInput) {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement } = input;
    
    // Technical features - more aggressive scoring
    const rsiSignal = this.normalizeRSI(indicators.rsi_14);
    const macdSignal = Math.tanh(indicators.macd_histogram * 20); // Increased sensitivity
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 50, 1); // More sensitive to trend
    
    // Momentum features
    const priceMomentum = this.calculatePriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 3); // Increased sensitivity
    
    // Volatility features
    const volatilityScore = this.getVolatilityScore(marketContext.volatilityRegime);
    const atrNormalized = indicators.bollinger_middle > 0 ? Math.min(indicators.atr / indicators.bollinger_middle, 0.1) * 10 : 0;
    
    // Market structure features
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    
    return {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum) / 2,
      volatility: (volatilityScore + atrNormalized) / 2,
      market_structure: (supportResistanceStrength + marketHourScore) / 2,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 10) // Increased sensitivity
    };
  }
  
  private calculateRawScore(features: any): number {
    let score = 0;
    
    // Apply weighted feature combination with bias towards action
    score += features.technical * this.modelWeights['rsi_signal'];
    score += features.momentum * this.modelWeights['price_momentum'];
    score += features.volatility * this.modelWeights['volatility_regime'];
    score += features.market_structure * this.modelWeights['market_hour'];
    score += features.orderbook_imbalance * this.modelWeights['imbalance'];
    
    // Add small positive bias to encourage more trading
    score += 0.1;
    
    return score;
  }
  
  private sigmoidActivation(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  
  private calculateConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.6; // Start with higher base confidence
    
    // Higher confidence in trending markets
    if (marketContext.trendDirection !== 'SIDEWAYS') {
      confidence += 0.2;
    }
    
    // Lower confidence in high volatility (but not as much)
    if (marketContext.volatilityRegime === 'HIGH') {
      confidence -= 0.1; // Reduced penalty
    }
    
    // Higher confidence with strong technical signals
    if (Math.abs(features.technical) > 0.6) { // Lowered threshold
      confidence += 0.15;
    }
    
    return Math.max(0.3, Math.min(0.95, confidence)); // Higher minimum confidence
  }
  
  private estimateExpectedReturn(probability: number, indicators: AdvancedIndicators): number {
    const baseReturn = (probability - 0.5) * 3; // Increased multiplier for more aggressive targets
    const volatilityMultiplier = indicators.bollinger_middle > 0 ? indicators.atr / indicators.bollinger_middle : 0.01;
    
    return baseReturn * volatilityMultiplier * 150; // Increased multiplier
  }
  
  private estimateTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 90; // Increased from 60 seconds
    
    // Adjust based on volatility
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.7; // Less aggressive reduction
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 1.5; // Less increase
    }
    
    // Adjust based on trend strength
    baseTime *= (1 + indicators.trend_strength / 200); // Reduced impact
    
    return Math.max(45, Math.min(180, baseTime)); // 45 seconds to 3 minutes
  }
  
  private calculateRiskScore(input: PredictionInput): number {
    let risk = 0.4; // Lower base risk
    
    // Higher risk in high volatility
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.2; // Reduced penalty
    }
    
    // Higher risk with extreme RSI
    if (input.indicators.rsi_14 < 25 || input.indicators.rsi_14 > 75) { // More extreme thresholds
      risk += 0.15;
    }
    
    // Lower risk in trending markets
    if (input.marketContext.trendDirection !== 'SIDEWAYS') {
      risk -= 0.15; // Increased benefit
    }
    
    return Math.max(0.1, Math.min(0.8, risk)); // Lower maximum risk
  }
  
  private retrainModel() {
    if (this.trainingData.length < 25) return; // Reduced minimum from 50
    
    // Simple gradient descent adjustment
    const recentTrades = this.trainingData.slice(-50); // Reduced from 100
    const learningRate = 0.02; // Increased learning rate
    
    recentTrades.forEach(trade => {
      const error = trade.success ? 1 - trade.prediction.probability : trade.prediction.probability;
      
      // Update weights based on feature importance and error
      Object.keys(this.modelWeights).forEach(key => {
        const adjustment = learningRate * error * (Math.random() - 0.5) * 0.2;
        this.modelWeights[key] += adjustment;
        
        // Keep weights in reasonable bounds
        this.modelWeights[key] = Math.max(0.01, Math.min(0.5, this.modelWeights[key]));
      });
    });
    
    console.log(`[AI Model] Model retrained with ${recentTrades.length} samples, Win rate: ${this.performanceMetrics.winRate.toFixed(2)}`);
  }
  
  private updatePerformanceMetrics() {
    if (this.trainingData.length === 0) return;
    
    const recentTrades = this.trainingData.slice(-100);
    const successfulTrades = recentTrades.filter(t => t.success);
    
    this.performanceMetrics.winRate = successfulTrades.length / recentTrades.length;
    this.performanceMetrics.totalTrades = this.trainingData.length;
    
    // Calculate Sharpe ratio
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
  
  // Helper methods
  private normalizeRSI(rsi: number): number {
    return (rsi - 50) / 50; // Convert to -1 to 1 range
  }
  
  private calculateBollingerPosition(indicators: AdvancedIndicators): number {
    const range = indicators.bollinger_upper - indicators.bollinger_lower;
    if (range === 0) return 0;
    
    const currentPrice = indicators.bollinger_middle; // Approximation
    return (currentPrice - indicators.bollinger_lower) / range - 0.5; // -0.5 to 0.5 range
  }
  
  private calculatePriceMomentum(recentPrices: number[]): number {
    if (recentPrices.length < 2) return 0;
    
    const momentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    return Math.tanh(momentum * 200); // Increased sensitivity
  }
  
  private getVolatilityScore(regime: string): number {
    switch (regime) {
      case 'LOW': return 0.4; // Increased from 0.3
      case 'MEDIUM': return 0.6;
      case 'HIGH': return 0.8; // Decreased from 0.9
      default: return 0.5;
    }
  }
  
  private calculateSRStrength(indicators: AdvancedIndicators): number {
    const range = indicators.resistance_level - indicators.support_level;
    const currentPrice = (indicators.support_level + indicators.resistance_level) / 2;
    return currentPrice > 0 ? Math.min(range / currentPrice, 0.1) * 10 : 0;
  }
  
  private getMarketHourScore(hour: string): number {
    switch (hour) {
      case 'OVERLAP': return 0.9;
      case 'NEW_YORK': return 0.8;
      case 'LONDON': return 0.7;
      case 'ASIA': return 0.6; // Increased from 0.5
      case 'LOW_LIQUIDITY': return 0.3; // Increased from 0.2
      default: return 0.5;
    }
  }
}
