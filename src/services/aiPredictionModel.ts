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
    // Technical indicators
    'rsi_signal': 0.15,
    'macd_signal': 0.12,
    'bollinger_position': 0.10,
    'trend_strength': 0.08,
    
    // Market context
    'volatility_regime': 0.10,
    'market_hour': 0.08,
    'trend_direction': 0.07,
    
    // Order book
    'imbalance': 0.12,
    'spread': 0.05,
    
    // Momentum
    'price_momentum': 0.08,
    'volume_momentum': 0.05
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
    
    // Retrain model every 10 trades
    if (this.trainingData.length % 10 === 0) {
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
    
    // Technical features
    const rsiSignal = this.normalizeRSI(indicators.rsi_14);
    const macdSignal = Math.tanh(indicators.macd_histogram * 10);
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 100, 1);
    
    // Momentum features
    const priceMomentum = this.calculatePriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 2);
    
    // Volatility features
    const volatilityScore = this.getVolatilityScore(marketContext.volatilityRegime);
    const atrNormalized = Math.min(indicators.atr / indicators.bollinger_middle, 0.1) * 10;
    
    // Market structure features
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    
    return {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum) / 2,
      volatility: (volatilityScore + atrNormalized) / 2,
      market_structure: (supportResistanceStrength + marketHourScore) / 2,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 5)
    };
  }
  
  private calculateRawScore(features: any): number {
    let score = 0;
    
    // Apply weighted feature combination
    score += features.technical * this.modelWeights['rsi_signal'];
    score += features.momentum * this.modelWeights['price_momentum'];
    score += features.volatility * this.modelWeights['volatility_regime'];
    score += features.market_structure * this.modelWeights['market_hour'];
    score += features.orderbook_imbalance * this.modelWeights['imbalance'];
    
    return score;
  }
  
  private sigmoidActivation(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  
  private calculateConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.5;
    
    // Higher confidence in trending markets
    if (marketContext.trendDirection !== 'SIDEWAYS') {
      confidence += 0.2;
    }
    
    // Lower confidence in high volatility
    if (marketContext.volatilityRegime === 'HIGH') {
      confidence -= 0.15;
    }
    
    // Higher confidence with strong technical signals
    if (Math.abs(features.technical) > 0.7) {
      confidence += 0.15;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }
  
  private estimateExpectedReturn(probability: number, indicators: AdvancedIndicators): number {
    const baseReturn = (probability - 0.5) * 2; // Convert to -1 to 1 range
    const volatilityMultiplier = indicators.atr / indicators.bollinger_middle;
    
    return baseReturn * volatilityMultiplier * 100; // Return as percentage
  }
  
  private estimateTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 60; // 1 minute default
    
    // Adjust based on volatility
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.5;
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 2;
    }
    
    // Adjust based on trend strength
    baseTime *= (1 + indicators.trend_strength / 100);
    
    return Math.max(30, Math.min(300, baseTime)); // 30 seconds to 5 minutes
  }
  
  private calculateRiskScore(input: PredictionInput): number {
    let risk = 0.5;
    
    // Higher risk in high volatility
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.3;
    }
    
    // Higher risk with extreme RSI
    if (input.indicators.rsi_14 < 20 || input.indicators.rsi_14 > 80) {
      risk += 0.2;
    }
    
    // Lower risk in trending markets
    if (input.marketContext.trendDirection !== 'SIDEWAYS') {
      risk -= 0.1;
    }
    
    return Math.max(0.1, Math.min(0.9, risk));
  }
  
  private retrainModel() {
    if (this.trainingData.length < 50) return;
    
    // Simple gradient descent adjustment
    const recentTrades = this.trainingData.slice(-100);
    const learningRate = 0.01;
    
    recentTrades.forEach(trade => {
      const error = trade.success ? 1 - trade.prediction.probability : trade.prediction.probability;
      
      // Update weights based on feature importance and error
      Object.keys(this.modelWeights).forEach(key => {
        const adjustment = learningRate * error * Math.random() * 0.1;
        this.modelWeights[key] += adjustment;
        
        // Keep weights in reasonable bounds
        this.modelWeights[key] = Math.max(0.01, Math.min(0.5, this.modelWeights[key]));
      });
    });
    
    console.log('Model retrained with', recentTrades.length, 'samples');
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
      const drawdown = (peak - runningReturn) / peak;
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
    return Math.tanh(momentum * 100); // Normalize with tanh
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
    return Math.min(range / currentPrice, 0.1) * 10; // Normalize to 0-1
  }
  
  private getMarketHourScore(hour: string): number {
    switch (hour) {
      case 'OVERLAP': return 0.9;
      case 'NEW_YORK': return 0.8;
      case 'LONDON': return 0.7;
      case 'ASIA': return 0.5;
      case 'LOW_LIQUIDITY': return 0.2;
      default: return 0.5;
    }
  }
}
