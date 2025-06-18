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
  featureContributions?: {
    [key: string]: number;
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
    minProbability: 0.48,
    minConfidence: 0.30,
    maxRiskScore: 0.80,
    kellyThreshold: 0.02
  };

  private signalMetrics = {
    lastSignalTime: 0,
    signalDroughtCount: 0,
    totalSignalsGenerated: 0,
    signalsInLastHour: 0,
    avgTimeBetweenSignals: 0,
    consecutiveNoSignals: 0
  };

  private marketOpportunityState = {
    isInOpportunityWindow: false,
    opportunityStartTime: 0,
    missedOpportunities: 0,
    lastOpportunityCheck: 0
  };

  // Enhanced initialization with proper state management
  constructor() {
    this.resetModelState();
    console.log('[AI Model] 🎯 Enhanced AI Prediction Model initialized with improved state management');
  }

  // Reset all model state to initial values
  resetModelState(): void {
    console.log('[AI Model] 🔄 Resetting model state completely');
    
    this.trainingData = [];
    
    // Reset performance metrics to defaults
    this.performanceMetrics = {
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

    // Reset adaptive thresholds to defaults
    this.adaptiveThresholds = {
      minProbability: 0.48,
      minConfidence: 0.30,
      maxRiskScore: 0.80,
      kellyThreshold: 0.02
    };

    // Reset signal tracking
    this.signalMetrics = {
      lastSignalTime: 0,
      signalDroughtCount: 0,
      totalSignalsGenerated: 0,
      signalsInLastHour: 0,
      avgTimeBetweenSignals: 0,
      consecutiveNoSignals: 0
    };

    // Reset model weights to defaults
    this.modelWeights = {
      'technical': 0.30,
      'momentum': 0.25,
      'volatility_regime': 0.15,
      'market_structure': 0.20,
      'orderbook_depth': 0.10,
    };

    console.log('[AI Model] ✅ Model state reset completed');
  }

  // Export current model state for persistence
  exportModelState(): any {
    return {
      trainingData: this.trainingData,
      modelWeights: { ...this.modelWeights },
      performanceMetrics: { ...this.performanceMetrics },
      adaptiveThresholds: { ...this.adaptiveThresholds },
      signalMetrics: { ...this.signalMetrics },
      marketOpportunityState: { ...this.marketOpportunityState },
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  // Enhanced bulk training data loading
  loadTrainingData(outcomes: TradeOutcome[]): void {
    console.log(`[AI Model] 📚 Loading ${outcomes.length} training outcomes`);
    
    // Clear existing data first
    this.trainingData = [];
    
    // Add new outcomes with proper validation
    outcomes.forEach(outcome => {
      if (this.validateTradeOutcome(outcome)) {
        this.trainingData.push(outcome);
      }
    });

    // Keep only the most recent trades (no hard cap, but reasonable limit)
    const maxTrainingData = 1000; // Increased from 500
    if (this.trainingData.length > maxTrainingData) {
      this.trainingData = this.trainingData.slice(-maxTrainingData);
      console.log(`[AI Model] ✂️ Trimmed training data to ${maxTrainingData} most recent trades`);
    }

    // Recalculate performance metrics based on loaded data
    this.updateEnhancedPerformanceMetrics();
    this.adaptThresholdsBasedOnPerformance();
    
    // Retrain model with the loaded data
    if (this.trainingData.length >= 10) {
      this.retrainModelWithRegimeAwareness();
    }

    console.log(`[AI Model] ✅ Successfully loaded ${this.trainingData.length} training outcomes`);
    console.log(`[AI Model] 📊 Updated metrics - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Total trades: ${this.performanceMetrics.totalTrades}`);
  }

  // Validate trade outcome data integrity
  private validateTradeOutcome(outcome: TradeOutcome): boolean {
    const required = ['entryPrice', 'exitPrice', 'profitLoss', 'holdingTime', 'prediction', 'actualReturn', 'success'];
    const isValid = required.every(field => outcome[field as keyof TradeOutcome] !== undefined && outcome[field as keyof TradeOutcome] !== null);
    
    if (!isValid) {
      console.warn('[AI Model] ⚠️ Invalid trade outcome detected, skipping');
      return false;
    }

    // Additional validation for reasonable values
    if (outcome.entryPrice <= 0 || outcome.exitPrice <= 0 || Math.abs(outcome.actualReturn) > 1000) {
      console.warn('[AI Model] ⚠️ Trade outcome has unreasonable values, skipping');
      return false;
    }

    return true;
  }

  // Enhanced method to get current model statistics
  getModelStatistics(): any {
    return {
      trainingDataSize: this.trainingData.length,
      performanceMetrics: { ...this.performanceMetrics },
      adaptiveThresholds: { ...this.adaptiveThresholds },
      signalMetrics: { ...this.signalMetrics },
      modelWeights: { ...this.modelWeights },
      recentTradesSample: this.trainingData.slice(-5).map(trade => ({
        success: trade.success,
        actualReturn: trade.actualReturn.toFixed(2),
        holdingTime: trade.holdingTime.toFixed(0),
        probability: trade.prediction.probability.toFixed(3)
      }))
    };
  }
  
  predict(input: PredictionInput): PredictionOutput {
    const features = this.extractRecalibratedFeatures(input);
    const rawScore = this.calculateEnhancedRawScore(features, input.marketContext);
    
    const probability = this.recalibratedSigmoidActivation(rawScore);
    
    const confidence = this.calculateEnhancedConfidence(features, input.marketContext);
    const expectedReturn = this.estimateExpectedReturn(probability, confidence, input.indicators, input.marketContext);
    const timeHorizon = this.estimateOptimalTimeHorizon(input.marketContext, input.indicators);
    const riskScore = this.calculateRecalibratedRiskScore(input);
    const kellyFraction = this.calculateOptimizedKellyFraction(probability, expectedReturn);
    const maxAdverseExcursion = this.estimateMAE(input.indicators, input.marketContext);
    
    const featureContributions = this.calculateFeatureContributions(features, input.marketContext);
    
    console.log(`[AI Model] 🎯 Recalibrated prediction - Prob: ${probability.toFixed(3)}, Raw Score: ${rawScore.toFixed(3)}, Kelly: ${kellyFraction.toFixed(3)}`);
    console.log(`[AI Model] 📊 Training data size: ${this.trainingData.length}, Total trades tracked: ${this.performanceMetrics.totalTrades}`);
    
    this.trackSignalGeneration(probability >= this.adaptiveThresholds.minProbability);
    
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
      maxAdverseExcursion,
      featureContributions
    };
  }
  
  updateModel(outcome: TradeOutcome) {
    // Validate before adding
    if (!this.validateTradeOutcome(outcome)) {
      console.warn('[AI Model] ⚠️ Skipping invalid trade outcome');
      return;
    }

    this.trainingData.push(outcome);
    
    // Use dynamic limit instead of hard cap
    const maxTrainingData = 1000; // Increased from 500
    if (this.trainingData.length > maxTrainingData) {
      this.trainingData = this.trainingData.slice(-maxTrainingData);
      console.log(`[AI Model] ✂️ Training data trimmed to ${maxTrainingData} most recent trades`);
    }
    
    this.updateEnhancedPerformanceMetrics();
    this.adaptThresholdsBasedOnPerformance();
    
    // More frequent retraining for faster adaptation
    if (this.trainingData.length % 2 === 0) {
      this.retrainModelWithRegimeAwareness();
    }
    
    this.updateOptimizedKellyThreshold();
    this.trackPredictionAccuracy(outcome);

    console.log(`[AI Model] 🎓 Model updated - Total training samples: ${this.trainingData.length}, Win rate: ${this.performanceMetrics.winRate.toFixed(3)}`);
  }
  
  getModelPerformance() {
    return {
      ...this.performanceMetrics,
      totalSamples: this.trainingData.length,
      actualTrainingDataSize: this.trainingData.length, // Add actual size for debugging
      lastUpdated: new Date().toISOString(),
      adaptiveThresholds: this.adaptiveThresholds,
      signalMetrics: this.signalMetrics,
      marketOpportunityState: this.marketOpportunityState,
      recentTrades: this.trainingData.slice(-10),
      modelStatistics: this.getModelStatistics()
    };
  }
  
  getAdaptiveThresholds() {
    return { ...this.adaptiveThresholds };
  }

  // Enhanced method to check for signal drought and adjust thresholds
  shouldBypassThresholds(): boolean {
    const now = Date.now();
    const timeSinceLastSignal = now - this.signalMetrics.lastSignalTime;
    const signalDroughtThreshold = 300000; // 5 minutes
    
    if (timeSinceLastSignal > signalDroughtThreshold) {
      this.signalMetrics.signalDroughtCount++;
      console.log(`[AI Model] ⚠️ Signal drought detected: ${(timeSinceLastSignal / 1000).toFixed(0)}s since last signal`);
      
      const droughtMultiplier = Math.max(0.7, 1 - (this.signalMetrics.signalDroughtCount * 0.05));
      return droughtMultiplier < 0.9;
    }
    
    return false;
  }

  // Get dynamic thresholds with drought bypass
  getDynamicThresholds(): typeof this.adaptiveThresholds {
    if (this.shouldBypassThresholds()) {
      const droughtMultiplier = Math.max(0.7, 1 - (this.signalMetrics.signalDroughtCount * 0.05));
      console.log(`[AI Model] 🔄 Applying drought bypass with multiplier: ${droughtMultiplier.toFixed(3)}`);
      
      return {
        minProbability: this.adaptiveThresholds.minProbability * droughtMultiplier,
        minConfidence: this.adaptiveThresholds.minConfidence * droughtMultiplier,
        maxRiskScore: Math.min(0.85, this.adaptiveThresholds.maxRiskScore / droughtMultiplier),
        kellyThreshold: this.adaptiveThresholds.kellyThreshold * droughtMultiplier
      };
    }
    
    return this.adaptiveThresholds;
  }
  
  // Recalibrated feature extraction with optimized sensitivity
  private extractRecalibratedFeatures(input: PredictionInput) {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement, deepOrderBookData } = input;
    
    // Technical features with recalibrated scaling
    const rsiSignal = this.normalizeRSIRecalibrated(indicators.rsi_14, marketContext.volatilityRegime);
    const macdSignal = Math.tanh(indicators.macd_histogram * this.getRecalibratedScaling(marketContext));
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 20, 1); // More sensitive
    
    // Enhanced momentum with better VWAP weighting
    const priceMomentum = this.calculateRecalibratedPriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 2); // Reduced sensitivity
    const vwapSignal = this.calculateEnhancedVWAPSignal(indicators);
    const macdMomentum = indicators.macd > indicators.macd_signal ? 0.3 : -0.3; // Increased from 0.25
    
    // Volatility features with better regime handling
    const volatilityScore = this.getRecalibratedVolatilityScore(marketContext.volatilityRegime, marketContext.marketRegime);
    const atrNormalized = indicators.bollinger_middle > 0 ? 
      Math.min(indicators.atr / indicators.bollinger_middle, 0.05) * 20 : 0;
    const bollingerWidth = this.calculateBollingerWidth(indicators);
    
    // Market structure with regime bias correction
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    const marketRegimeScore = this.getRecalibratedMarketRegimeScore(marketContext.marketRegime, marketContext.volatilityRegime);
    const liquidityScore = marketContext.liquidityScore;
    
    // Enhanced order book analysis
    const orderbookDepthScore = this.calculateEnhancedOrderbookDepth(deepOrderBookData, orderBookImbalance);
    
    const features = {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum + vwapSignal + macdMomentum) / 4,
      volatility: (volatilityScore + atrNormalized + bollingerWidth) / 3,
      market_structure: (supportResistanceStrength + marketHourScore + marketRegimeScore + liquidityScore) / 4,
      orderbook_depth: orderbookDepthScore,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 8)
    };

    console.log(`[Features] 📊 Recalibrated features - Tech: ${features.technical.toFixed(3)}, Momentum: ${features.momentum.toFixed(3)}, Market: ${features.market_structure.toFixed(3)}, OB: ${features.orderbook_depth.toFixed(3)}`);
    
    return features;
  }
  
  // Recalibrated scaling with better regime awareness
  private getRecalibratedScaling(marketContext: MarketContext): number {
    let baseScaling = 15; // Increased from 10 for better sensitivity
    
    switch (marketContext.volatilityRegime) {
      case 'HIGH':
        return baseScaling * 0.8; // Less aggressive reduction
      case 'LOW':
        return baseScaling * 1.2; // Moderate increase
      default:
        return baseScaling;
    }
  }
  
  // Enhanced RSI normalization with better thresholds
  private normalizeRSIRecalibrated(rsi: number, volatilityRegime: string): number {
    let overboughtLevel = 68; // Lowered from 70
    let oversoldLevel = 32;   // Raised from 30
    
    // More aggressive adjustments for volatility
    if (volatilityRegime === 'HIGH') {
      overboughtLevel = 72;
      oversoldLevel = 28;
    } else if (volatilityRegime === 'LOW') {
      overboughtLevel = 62;
      oversoldLevel = 38;
    }
    
    if (rsi > overboughtLevel) return (rsi - overboughtLevel) / (100 - overboughtLevel);
    if (rsi < oversoldLevel) return (oversoldLevel - rsi) / oversoldLevel;
    return (rsi - 50) / 50;
  }
  
  // Enhanced VWAP signal with better sensitivity
  private calculateEnhancedVWAPSignal(indicators: AdvancedIndicators): number {
    if (indicators.vwap === 0 || indicators.bollinger_middle === 0) return 0;
    
    const priceVsVWAP = (indicators.bollinger_middle - indicators.vwap) / indicators.vwap;
    return Math.tanh(priceVsVWAP * 150); // Increased from 100 for better sensitivity
  }
  
  // Recalibrated price momentum calculation
  private calculateRecalibratedPriceMomentum(recentPrices: number[]): number {
    if (recentPrices.length < 2) return 0;
    
    const momentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    return Math.tanh(momentum * 400); // Increased from 300 for better sensitivity
  }
  
  // Enhanced order book depth analysis
  private calculateEnhancedOrderbookDepth(deepData: any, imbalance: number): number {
    if (!deepData) {
      return Math.tanh(imbalance * 10); // Increased from 8
    }
    
    const { bidDepth, askDepth, weightedMidPrice } = deepData;
    
    const totalBidDepth = bidDepth.reduce((sum, depth) => sum + depth, 0);
    const totalAskDepth = askDepth.reduce((sum, depth) => sum + depth, 0);
    const depthImbalance = (totalBidDepth - totalAskDepth) / (totalBidDepth + totalAskDepth);
    
    const depthScore = Math.tanh(depthImbalance * 6); // Increased from 5
    const imbalanceScore = Math.tanh(imbalance * 10);
    
    return (depthScore + imbalanceScore) / 2;
  }
  
  // Optimized Kelly Criterion calculation
  private calculateOptimizedKellyFraction(probability: number, expectedReturn: number): number {
    const winProbability = probability;
    const lossProbability = 1 - probability;
    const avgWin = Math.abs(expectedReturn);
    const avgLoss = Math.abs(expectedReturn) * 0.4; // Better risk-reward ratio assumption
    
    if (avgLoss === 0) return 0;
    
    const kellyFraction = (winProbability * avgWin - lossProbability * avgLoss) / avgWin;
    
    // Progressive Kelly sizing based on confidence
    const adjustedKelly = Math.max(0, Math.min(0.20, kellyFraction)); // Increased cap from 0.15
    
    console.log(`[Kelly] 📊 Optimized Kelly - Raw: ${kellyFraction.toFixed(3)}, Adjusted: ${adjustedKelly.toFixed(3)}, Win Prob: ${winProbability.toFixed(3)}`);
    
    return adjustedKelly;
  }
  
  // Enhanced confidence calculation with better regime handling
  private calculateEnhancedConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.55; // Lowered base from 0.6

    // Recalibrated market regime confidence adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            confidence += 0.18; // Increased from 0.15
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            confidence += 0.08; // Increased from 0.05
            break;
        case 'SIDEWAYS_VOLATILE':
            confidence -= 0.10; // Reduced penalty from -0.15
            break;
        case 'SIDEWAYS_QUIET':
            confidence -= 0.05; // Reduced penalty from -0.1
            break;
    }
    
    // Enhanced liquidity and spread quality adjustments
    confidence += (marketContext.liquidityScore - 0.5) * 0.25; // Increased from 0.2
    confidence += (marketContext.spreadQuality - 0.5) * 0.20; // Increased from 0.15
    
    // Better technical signal strength weighting
    const technicalStrength = Math.abs(features.technical);
    if (technicalStrength > 0.6) {
      confidence += 0.15; // Increased from 0.12
    } else if (technicalStrength > 0.4) { // Lowered threshold from 0.5
      confidence += 0.10; // Increased from 0.08
    }
    
    // Enhanced order book depth confidence
    if (Math.abs(features.orderbook_depth) > 0.5) { // Lowered threshold from 0.6
      confidence += 0.12; // Increased from 0.1
    }
    
    return Math.max(0.25, Math.min(0.92, confidence)); // Adjusted range
  }

  // Recalibrated market regime scoring with bias correction
  private getRecalibratedMarketRegimeScore(regime: MarketContext['marketRegime'], volatilityRegime: string): number {
    let baseScore = 0;
    
    switch (regime) {
      case 'STRONG_BULL': 
        baseScore = 0.8; // Reduced from 0.9
        break;
      case 'WEAK_BULL': 
        baseScore = 0.4; // Reduced from 0.5
        break;
      case 'STRONG_BEAR': 
        baseScore = -0.8; // Increased from -0.9
        break;
      case 'WEAK_BEAR': 
        baseScore = -0.2; // Significantly increased from -0.5
        break;
      case 'SIDEWAYS_VOLATILE': 
        baseScore = -0.1; // Increased from -0.3
        break;
      case 'SIDEWAYS_QUIET': 
        baseScore = 0.1; // Increased from 0.0
        break;
      default: 
        baseScore = 0;
    }
    
    // Counter-trend bias detection and correction
    if (regime === 'WEAK_BEAR' && volatilityRegime === 'LOW') {
      baseScore += 0.3; // Add counter-trend opportunity boost
      console.log(`[Regime] 🔄 Counter-trend boost applied for WEAK_BEAR + LOW volatility`);
    }
    
    return baseScore;
  }

  // Recalibrated volatility scoring with regime awareness
  private getRecalibratedVolatilityScore(volatilityRegime: string, marketRegime: string): number {
    let baseScore = 0.5;
    
    switch (volatilityRegime) {
      case 'LOW': 
        baseScore = 0.4; // Increased from 0.3
        break;
      case 'MEDIUM': 
        baseScore = 0.6;
        break;
      case 'HIGH': 
        baseScore = 0.8; // Reduced from 0.9
        break;
    }
    
    // Adjust based on market regime compatibility
    if (volatilityRegime === 'LOW' && (marketRegime === 'WEAK_BEAR' || marketRegime === 'WEAK_BULL')) {
      baseScore += 0.2; // Boost for low volatility in weak trends
    }
    
    return baseScore;
  }

  // Enhanced raw score calculation with regime awareness
  private calculateEnhancedRawScore(features: any, marketContext: MarketContext): number {
    let score = 0;
    
    // Apply weights with regime-based adjustments
    const regimeMultipliers = this.getRegimeMultipliers(marketContext);
    
    score += features.technical * this.modelWeights['technical'] * regimeMultipliers.technical;
    score += features.momentum * this.modelWeights['momentum'] * regimeMultipliers.momentum;
    score += features.volatility * this.modelWeights['volatility_regime'] * regimeMultipliers.volatility;
    score += features.market_structure * this.modelWeights['market_structure'] * regimeMultipliers.market_structure;
    score += features.orderbook_depth * this.modelWeights['orderbook_depth'] * regimeMultipliers.orderbook;
    
    // Performance-based bias with better calibration
    const recentWinRate = this.getRecentWinRate();
    const performanceBias = (recentWinRate - 0.5) * 0.10; // Reduced from 0.15
    score += performanceBias;
    
    // Market opportunity boost
    if (this.detectMarketOpportunity(features, marketContext)) {
      score += 0.15;
      console.log(`[AI Model] 🎯 Market opportunity boost applied: +0.15`);
    }
    
    console.log(`[AI Model] 📊 Enhanced raw score: ${score.toFixed(3)}, Performance bias: ${performanceBias.toFixed(3)}`);
    
    return score;
  }

  // Get regime-specific multipliers for feature weights
  private getRegimeMultipliers(marketContext: MarketContext) {
    const regime = marketContext.marketRegime;
    const volatility = marketContext.volatilityRegime;
    
    let multipliers = {
      technical: 1.0,
      momentum: 1.0,
      volatility: 1.0,
      market_structure: 1.0,
      orderbook: 1.0
    };
    
    // Adjust multipliers based on market conditions
    switch (regime) {
      case 'WEAK_BEAR':
        if (volatility === 'LOW') {
          multipliers.momentum = 1.3; // Boost momentum signals in weak bear + low vol
          multipliers.technical = 1.2;
          console.log(`[Regime] 🔧 Applying WEAK_BEAR + LOW volatility multipliers`);
        }
        break;
      case 'SIDEWAYS_VOLATILE':
        multipliers.orderbook = 1.4; // Boost orderbook signals in choppy markets
        multipliers.technical = 0.8;
        break;
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        multipliers.momentum = 1.2; // Boost momentum in strong trends
        break;
    }
    
    return multipliers;
  }

  // Detect market opportunity windows
  private detectMarketOpportunity(features: any, marketContext: MarketContext): boolean {
    const now = Date.now();
    
    // Check for strong technical confluence
    const technicalStrength = Math.abs(features.technical);
    const momentumStrength = Math.abs(features.momentum);
    const orderbookStrength = Math.abs(features.orderbook_depth);
    
    const hasStrongConfluence = technicalStrength > 0.6 && momentumStrength > 0.5 && orderbookStrength > 0.4;
    
    // Check for favorable market conditions
    const hasGoodLiquidity = marketContext.liquidityScore > 0.3;
    const hasGoodSpread = marketContext.spreadQuality > 0.5;
    
    const isOpportunity = hasStrongConfluence && hasGoodLiquidity && hasGoodSpread;
    
    if (isOpportunity && !this.marketOpportunityState.isInOpportunityWindow) {
      this.marketOpportunityState.isInOpportunityWindow = true;
      this.marketOpportunityState.opportunityStartTime = now;
      console.log(`[Opportunity] 🎯 Market opportunity window opened`);
    } else if (!isOpportunity && this.marketOpportunityState.isInOpportunityWindow) {
      this.marketOpportunityState.isInOpportunityWindow = false;
      console.log(`[Opportunity] 🚪 Market opportunity window closed`);
    }
    
    return isOpportunity;
  }

  // Recalibrated sigmoid activation for better probability distribution
  private recalibratedSigmoidActivation(x: number): number {
    // Enhanced sigmoid with better slope and offset
    const slope = 1.5; // Increased from 1.2 for steeper curve
    const offset = 0.02; // Small offset to boost probabilities slightly
    return (1 / (1 + Math.exp(-x * slope))) + offset;
  }

  // Calculate feature contributions for detailed analysis
  private calculateFeatureContributions(features: any, marketContext: MarketContext): { [key: string]: number } {
    const regimeMultipliers = this.getRegimeMultipliers(marketContext);
    
    return {
      technical: features.technical * this.modelWeights['technical'] * regimeMultipliers.technical,
      momentum: features.momentum * this.modelWeights['momentum'] * regimeMultipliers.momentum,
      volatility: features.volatility * this.modelWeights['volatility_regime'] * regimeMultipliers.volatility,
      market_structure: features.market_structure * this.modelWeights['market_structure'] * regimeMultipliers.market_structure,
      orderbook_depth: features.orderbook_depth * this.modelWeights['orderbook_depth'] * regimeMultipliers.orderbook
    };
  }

  // Track signal generation frequency and patterns
  private trackSignalGeneration(signalGenerated: boolean): void {
    const now = Date.now();
    
    if (signalGenerated) {
      this.signalMetrics.lastSignalTime = now;
      this.signalMetrics.totalSignalsGenerated++;
      this.signalMetrics.signalDroughtCount = 0;
      this.signalMetrics.consecutiveNoSignals = 0;
      
      // Update signals per hour tracking
      const oneHourAgo = now - 3600000;
      this.signalMetrics.signalsInLastHour++;
      
      console.log(`[Signal Tracking] ✅ Signal generated. Total: ${this.signalMetrics.totalSignalsGenerated}, Last hour: ${this.signalMetrics.signalsInLastHour}`);
    } else {
      this.signalMetrics.consecutiveNoSignals++;
      
      if (this.signalMetrics.consecutiveNoSignals % 10 === 0) {
        console.log(`[Signal Tracking] ⚠️ ${this.signalMetrics.consecutiveNoSignals} consecutive no-signals`);
      }
    }
    
    // Calculate average time between signals
    if (this.signalMetrics.totalSignalsGenerated > 1) {
      const timeSinceStart = now - (this.signalMetrics.lastSignalTime - (this.signalMetrics.totalSignalsGenerated * 60000)); // Rough estimate
      this.signalMetrics.avgTimeBetweenSignals = timeSinceStart / this.signalMetrics.totalSignalsGenerated;
    }
  }

  // Track prediction accuracy for model improvement
  private trackPredictionAccuracy(outcome: TradeOutcome): void {
    const prediction = outcome.prediction;
    const actualSuccess = outcome.success;
    const predictedSuccess = prediction.probability > 0.5;
    
    const accuracyMatch = actualSuccess === predictedSuccess;
    
    console.log(`[Accuracy Tracking] 📊 Prediction vs Reality - Predicted: ${predictedSuccess}, Actual: ${actualSuccess}, Match: ${accuracyMatch}`);
    console.log(`[Accuracy Tracking] 📈 Expected return: ${prediction.expectedReturn.toFixed(2)}%, Actual: ${outcome.actualReturn.toFixed(2)}%`);
    console.log(`[Accuracy Tracking] 🎯 MAE prediction: ${prediction.maxAdverseExcursion.toFixed(2)}%, Actual: ${outcome.maxAdverseExcursion.toFixed(2)}%`);
  }

  // Update optimized Kelly threshold based on performance
  private updateOptimizedKellyThreshold(): void {
    if (this.trainingData.length < 15) return;
    
    const recentWinRate = this.getRecentWinRate();
    const profitFactor = this.performanceMetrics.profitFactor;
    const avgKelly = this.trainingData.slice(-20).reduce((sum, t) => sum + t.prediction.kellyFraction, 0) / 20;
    
    console.log(`[Kelly Optimization] 📊 Recent metrics - Win rate: ${recentWinRate.toFixed(3)}, Profit factor: ${profitFactor.toFixed(2)}, Avg Kelly: ${avgKelly.toFixed(3)}`);
    
    // More aggressive Kelly threshold adjustment
    if (recentWinRate > 0.60 && profitFactor > 1.2) {
      this.adaptiveThresholds.kellyThreshold = Math.min(0.15, this.adaptiveThresholds.kellyThreshold * 1.15);
      console.log(`[Kelly Optimization] ⬆️ Increasing Kelly threshold to ${this.adaptiveThresholds.kellyThreshold.toFixed(3)}`);
    } else if (recentWinRate < 0.40 || profitFactor < 0.9) {
      this.adaptiveThresholds.kellyThreshold = Math.max(0.01, this.adaptiveThresholds.kellyThreshold * 0.85);
      console.log(`[Kelly Optimization] ⬇️ Decreasing Kelly threshold to ${this.adaptiveThresholds.kellyThreshold.toFixed(3)}`);
    }
  }

  // Recalibrated risk score calculation
  private calculateRecalibratedRiskScore(input: PredictionInput): number {
    let risk = 0.25; // Lowered base from 0.3

    // Adjusted regime risk penalties
    switch (input.marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            risk -= 0.06; // Reduced from -0.08
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            risk -= 0.01; // Reduced from -0.03
            break;
        case 'SIDEWAYS_VOLATILE':
            risk += 0.15; // Reduced from +0.2
            break;
        case 'SIDEWAYS_QUIET':
            risk += 0.05; // Reduced from +0.08
            break;
    }
    
    // Volatility adjustments
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.08; // Reduced from 0.12
    } else if (input.marketContext.volatilityRegime === 'LOW') {
      risk -= 0.01; // Reduced from -0.03
    }
    
    // Liquidity and spread adjustments (more favorable)
    risk -= (input.marketContext.liquidityScore - 0.5) * 0.20; // Increased from 0.15
    risk -= (input.marketContext.spreadQuality - 0.5) * 0.15; // Increased from 0.1
    
    // RSI extremes (less penalty)
    if (input.indicators.rsi_14 < 25 || input.indicators.rsi_14 > 75) {
      risk += 0.05; // Reduced from 0.08
    }
    
    // Order book imbalance (less penalty)
    if (Math.abs(input.orderBookImbalance) > 0.6) {
      risk += 0.03; // Reduced from 0.05
    }
    
    return Math.max(0.05, Math.min(0.80, risk)); // Adjusted range
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
    
    const liquidityMultiplier = 0.8 + (marketContext.liquidityScore * 0.4);
    
    const baseReturn = potentialReturnPercent * 0.25;
    const adjustedReturn = baseReturn * regimeMultiplier * volatilityMultiplier * liquidityMultiplier;
    const finalReturn = adjustedReturn * confidence * Math.abs(probability - 0.5) * 4;
    
    return Math.max(0.05, Math.min(1.8, finalReturn));
  }
  
  private estimateOptimalTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 60;
    
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
    
    baseTime *= (1.5 - marketContext.liquidityScore * 0.5);
    
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.6;
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 1.3;
    }
    
    baseTime *= (1 + indicators.trend_strength / 400);
    
    return Math.max(20, Math.min(180, baseTime));
  }

  private updateEnhancedPerformanceMetrics() {
    if (this.trainingData.length === 0) {
      // Reset to defaults when no data
      this.performanceMetrics.totalTrades = 0;
      this.performanceMetrics.winRate = 0.5;
      return;
    }
    
    const recentTrades = this.trainingData.slice(-50);
    const successfulTrades = recentTrades.filter(t => t.success);
    
    this.performanceMetrics.winRate = successfulTrades.length / recentTrades.length;
    this.performanceMetrics.totalTrades = this.trainingData.length; // Use actual training data length
    
    const returns = recentTrades.map(t => t.actualReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    this.performanceMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    this.performanceMetrics.avgMAE = recentTrades.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / recentTrades.length;
    this.performanceMetrics.avgMFE = recentTrades.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / recentTrades.length;
    
    const grossProfit = recentTrades.filter(t => t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    const grossLoss = recentTrades.filter(t => !t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    this.performanceMetrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1.0;
    
    console.log(`[AI Model] 📊 Performance metrics updated - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Total trades: ${this.performanceMetrics.totalTrades}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}`);
  }

  private adaptThresholdsBasedOnPerformance() {
    if (this.trainingData.length < 10) return;
    
    const recentTrades = this.trainingData.slice(-20);
    const winRate = recentTrades.filter(t => t.success).length / recentTrades.length;
    const profitFactor = this.performanceMetrics.profitFactor;
    
    // More aggressive threshold adaptation
    if (winRate > 0.55 && profitFactor > 1.15) {
      this.adaptiveThresholds.minProbability = Math.min(0.52, this.adaptiveThresholds.minProbability + 0.008);
      this.adaptiveThresholds.minConfidence = Math.min(0.45, this.adaptiveThresholds.minConfidence + 0.008);
    } else if (winRate < 0.42 || profitFactor < 0.92) {
      this.adaptiveThresholds.minProbability = Math.max(0.45, this.adaptiveThresholds.minProbability - 0.012);
      this.adaptiveThresholds.minConfidence = Math.max(0.25, this.adaptiveThresholds.minConfidence - 0.012);
    }
    
    const avgRisk = recentTrades.reduce((sum, t) => sum + t.prediction.riskScore, 0) / recentTrades.length;
    if (winRate > 0.52 && avgRisk < 0.45) {
      this.adaptiveThresholds.maxRiskScore = Math.min(0.85, this.adaptiveThresholds.maxRiskScore + 0.02);
    } else if (winRate < 0.48) {
      this.adaptiveThresholds.maxRiskScore = Math.max(0.65, this.adaptiveThresholds.maxRiskScore - 0.02);
    }
  }

  private retrainModelWithRegimeAwareness() {
    if (this.trainingData.length < 20) return;
    
    const recentTrades = this.trainingData.slice(-40);
    const learningRate = 0.03; // Increased from 0.025
    
    const successfulTrades = recentTrades.filter(t => t.success);
    const failedTrades = recentTrades.filter(t => !t.success);
    
    if (successfulTrades.length > 0 && failedTrades.length > 0) {
      const successFeatures = this.analyzeFeaturePerformance(successfulTrades);
      const failFeatures = this.analyzeFeaturePerformance(failedTrades);
      
      Object.keys(this.modelWeights).forEach(key => {
        const successAvg = successFeatures[key] || 0;
        const failAvg = failFeatures[key] || 0;
        const importance = Math.abs(successAvg - failAvg);
        
        if (importance > 0.2) { // Lowered threshold from 0.25
          this.modelWeights[key] *= (1 + learningRate * 1.5);
        } else if (importance < 0.08) { // Lowered threshold from 0.1
          this.modelWeights[key] *= (1 - learningRate * 0.7);
        }
        
        this.modelWeights[key] = Math.max(0.05, Math.min(0.45, this.modelWeights[key]));
      });
      
      const totalWeight = Object.values(this.modelWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key] /= totalWeight;
      });
    }
    
    console.log(`[AI Model] 🎓 Retraining completed - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}`);
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

  private estimateMAE(indicators: AdvancedIndicators, marketContext: MarketContext): number {
    let baseMAE = 0.5;
    
    const atrPercent = indicators.bollinger_middle > 0 ? 
      (indicators.atr / indicators.bollinger_middle) * 100 : 0.5;
    
    baseMAE = Math.max(0.3, Math.min(2.0, atrPercent * 0.8));
    
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
  
  private calculateSRStrength(indicators: AdvancedIndicators): number {
    const range = indicators.resistance_level - indicators.support_level;
    const currentPrice = (indicators.support_level + indicators.resistance_level) / 2;
    if (currentPrice <= 0) return 0;
    return Math.min(range / currentPrice, 0.05) * 20;
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
}
