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
    'technical': 0.32,        // Increased
    'momentum': 0.28,         // Increased
    'volatility_regime': 0.12, // Reduced
    'market_structure': 0.18,  // Reduced
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
  
  // OPTIMIZED: More aggressive thresholds for increased signal generation
  private adaptiveThresholds = {
    minProbability: 0.44,  // Significantly lowered from 0.48
    minConfidence: 0.22,   // Significantly lowered from 0.30
    maxRiskScore: 0.88,    // Significantly increased from 0.80
    kellyThreshold: 0.008  // Drastically lowered from 0.02
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
  
  predict(input: PredictionInput): PredictionOutput {
    const features = this.extractOptimizedFeatures(input);
    const rawScore = this.calculateOptimizedRawScore(features, input.marketContext);
    
    // OPTIMIZED: Enhanced sigmoid activation for better probability distribution
    const probability = this.optimizedSigmoidActivation(rawScore);
    
    const confidence = this.calculateOptimizedConfidence(features, input.marketContext);
    const expectedReturn = this.estimateExpectedReturn(probability, confidence, input.indicators, input.marketContext);
    const timeHorizon = this.estimateOptimalTimeHorizon(input.marketContext, input.indicators);
    const riskScore = this.calculateOptimizedRiskScore(input);
    const kellyFraction = this.calculateEnhancedKellyFraction(probability, expectedReturn);
    const maxAdverseExcursion = this.estimateMAE(input.indicators, input.marketContext);
    
    // Enhanced feature contribution tracking
    const featureContributions = this.calculateFeatureContributions(features, input.marketContext);
    
    console.log(`[OPTIMIZED AI] 🚀 Enhanced prediction - Prob: ${probability.toFixed(3)}, Raw Score: ${rawScore.toFixed(3)}, Kelly: ${kellyFraction.toFixed(3)}`);
    console.log(`[OPTIMIZED AI] 📊 Feature contributions - Tech: ${featureContributions.technical.toFixed(3)}, Momentum: ${featureContributions.momentum.toFixed(3)}, Market: ${featureContributions.market_structure.toFixed(3)}`);
    
    this.trackOptimizedSignalGeneration(probability >= this.adaptiveThresholds.minProbability);
    
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
    this.trainingData.push(outcome);
    
    if (this.trainingData.length > 500) {
      this.trainingData = this.trainingData.slice(-500);
    }
    
    this.updateOptimizedPerformanceMetrics();
    this.adaptOptimizedThresholdsBasedOnPerformance();
    
    // More frequent retraining for faster adaptation
    if (this.trainingData.length % 2 === 0) {
      this.retrainOptimizedModelWithRegimeAwareness();
    }
    
    this.updateEnhancedKellyThreshold();
    this.trackOptimizedPredictionAccuracy(outcome);
  }
  
  getModelPerformance() {
    return {
      ...this.performanceMetrics,
      totalSamples: this.trainingData.length,
      lastUpdated: new Date().toISOString(),
      adaptiveThresholds: this.adaptiveThresholds,
      signalMetrics: this.signalMetrics,
      marketOpportunityState: this.marketOpportunityState,
      recentTrades: this.trainingData.slice(-10)
    };
  }
  
  getAdaptiveThresholds() {
    return { ...this.adaptiveThresholds };
  }

  // OPTIMIZED: Enhanced drought detection with more aggressive bypass
  shouldBypassThresholds(): boolean {
    const now = Date.now();
    const timeSinceLastSignal = now - this.signalMetrics.lastSignalTime;
    const signalDroughtThreshold = 180000; // Reduced from 300000 (3 minutes)
    
    if (timeSinceLastSignal > signalDroughtThreshold) {
      this.signalMetrics.signalDroughtCount++;
      console.log(`[OPTIMIZED AI] ⚠️ Signal drought detected: ${(timeSinceLastSignal / 1000).toFixed(0)}s since last signal`);
      
      // More aggressive threshold reduction
      const droughtMultiplier = Math.max(0.6, 1 - (this.signalMetrics.signalDroughtCount * 0.08)); // More aggressive
      return droughtMultiplier < 0.95; // More permissive trigger
    }
    
    return false;
  }

  // OPTIMIZED: More aggressive dynamic thresholds
  getDynamicThresholds(): typeof this.adaptiveThresholds {
    if (this.shouldBypassThresholds()) {
      const droughtMultiplier = Math.max(0.6, 1 - (this.signalMetrics.signalDroughtCount * 0.08));
      console.log(`[OPTIMIZED AI] 🔄 Applying aggressive drought bypass with multiplier: ${droughtMultiplier.toFixed(3)}`);
      
      return {
        minProbability: this.adaptiveThresholds.minProbability * droughtMultiplier,
        minConfidence: this.adaptiveThresholds.minConfidence * droughtMultiplier,
        maxRiskScore: Math.min(0.95, this.adaptiveThresholds.maxRiskScore / droughtMultiplier), // Higher ceiling
        kellyThreshold: this.adaptiveThresholds.kellyThreshold * droughtMultiplier
      };
    }
    
    return this.adaptiveThresholds;
  }
  
  // OPTIMIZED: Enhanced feature extraction with aggressive scaling
  private extractOptimizedFeatures(input: PredictionInput) {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement, deepOrderBookData } = input;
    
    // More sensitive technical features
    const rsiSignal = this.normalizeOptimizedRSI(indicators.rsi_14, marketContext.volatilityRegime);
    const macdSignal = Math.tanh(indicators.macd_histogram * this.getOptimizedScaling(marketContext));
    const bollingerPosition = this.calculateBollingerPosition(indicators);
    const trendStrength = Math.min(indicators.trend_strength / 15, 1); // More sensitive
    
    // Enhanced momentum features
    const priceMomentum = this.calculateOptimizedPriceMomentum(recentPriceMovement);
    const volumeMomentum = Math.tanh((indicators.volume_ratio - 1) * 2.5); // Increased sensitivity
    const vwapSignal = this.calculateOptimizedVWAPSignal(indicators);
    const macdMomentum = indicators.macd > indicators.macd_signal ? 0.4 : -0.4; // Increased
    
    // More aggressive volatility features
    const volatilityScore = this.getOptimizedVolatilityScore(marketContext.volatilityRegime, marketContext.marketRegime);
    const atrNormalized = indicators.bollinger_middle > 0 ? 
      Math.min(indicators.atr / indicators.bollinger_middle, 0.04) * 25 : 0; // More sensitive
    const bollingerWidth = this.calculateBollingerWidth(indicators);
    
    // Enhanced market structure
    const supportResistanceStrength = this.calculateSRStrength(indicators);
    const marketHourScore = this.getMarketHourScore(marketContext.marketHour);
    const marketRegimeScore = this.getOptimizedMarketRegimeScore(marketContext.marketRegime, marketContext.volatilityRegime);
    const liquidityScore = marketContext.liquidityScore;
    
    // More aggressive order book analysis
    const orderbookDepthScore = this.calculateOptimizedOrderbookDepth(deepOrderBookData, orderBookImbalance);
    
    const features = {
      technical: (rsiSignal + macdSignal + bollingerPosition + trendStrength) / 4,
      momentum: (priceMomentum + volumeMomentum + vwapSignal + macdMomentum) / 4,
      volatility: (volatilityScore + atrNormalized + bollingerWidth) / 3,
      market_structure: (supportResistanceStrength + marketHourScore + marketRegimeScore + liquidityScore) / 4,
      orderbook_depth: orderbookDepthScore,
      orderbook_imbalance: Math.tanh(orderBookImbalance * 10) // Increased sensitivity
    };

    console.log(`[OPTIMIZED Features] 🚀 Enhanced features - Tech: ${features.technical.toFixed(3)}, Momentum: ${features.momentum.toFixed(3)}, Market: ${features.market_structure.toFixed(3)}, OB: ${features.orderbook_depth.toFixed(3)}`);
    
    return features;
  }
  
  // OPTIMIZED: More aggressive scaling
  private getOptimizedScaling(marketContext: MarketContext): number {
    let baseScaling = 20; // Increased from 15
    
    switch (marketContext.volatilityRegime) {
      case 'HIGH':
        return baseScaling * 0.85; // Less aggressive reduction
      case 'LOW':
        return baseScaling * 1.3;  // More aggressive increase
      default:
        return baseScaling;
    }
  }
  
  // OPTIMIZED: More aggressive RSI normalization
  private normalizeOptimizedRSI(rsi: number, volatilityRegime: string): number {
    let overboughtLevel = 65; // Lowered from 68
    let oversoldLevel = 35;   // Raised from 32
    
    if (volatilityRegime === 'HIGH') {
      overboughtLevel = 70;
      oversoldLevel = 30;
    } else if (volatilityRegime === 'LOW') {
      overboughtLevel = 60;
      oversoldLevel = 40;
    }
    
    if (rsi > overboughtLevel) return (rsi - overboughtLevel) / (100 - overboughtLevel);
    if (rsi < oversoldLevel) return (oversoldLevel - rsi) / oversoldLevel;
    return (rsi - 50) / 50;
  }
  
  // OPTIMIZED: Enhanced VWAP signal
  private calculateOptimizedVWAPSignal(indicators: AdvancedIndicators): number {
    if (indicators.vwap === 0 || indicators.bollinger_middle === 0) return 0;
    
    const priceVsVWAP = (indicators.bollinger_middle - indicators.vwap) / indicators.vwap;
    return Math.tanh(priceVsVWAP * 200); // Increased from 150
  }
  
  // OPTIMIZED: More sensitive price momentum
  private calculateOptimizedPriceMomentum(recentPrices: number[]): number {
    if (recentPrices.length < 2) return 0;
    
    const momentum = (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0];
    return Math.tanh(momentum * 500); // Increased from 400
  }
  
  // OPTIMIZED: Enhanced order book depth
  private calculateOptimizedOrderbookDepth(deepData: any, imbalance: number): number {
    if (!deepData) {
      return Math.tanh(imbalance * 12); // Increased from 10
    }
    
    const { bidDepth, askDepth, weightedMidPrice } = deepData;
    
    const totalBidDepth = bidDepth.reduce((sum, depth) => sum + depth, 0);
    const totalAskDepth = askDepth.reduce((sum, depth) => sum + depth, 0);
    const depthImbalance = (totalBidDepth - totalAskDepth) / (totalBidDepth + totalAskDepth);
    
    const depthScore = Math.tanh(depthImbalance * 8); // Increased from 6
    const imbalanceScore = Math.tanh(imbalance * 12);
    
    return (depthScore + imbalanceScore) / 2;
  }
  
  // OPTIMIZED: Enhanced Kelly Criterion
  private calculateEnhancedKellyFraction(probability: number, expectedReturn: number): number {
    const winProbability = probability;
    const lossProbability = 1 - probability;
    const avgWin = Math.abs(expectedReturn);
    const avgLoss = Math.abs(expectedReturn) * 0.35; // Better risk-reward assumption
    
    if (avgLoss === 0) return 0;
    
    const kellyFraction = (winProbability * avgWin - lossProbability * avgLoss) / avgWin;
    
    // More aggressive Kelly sizing
    const adjustedKelly = Math.max(0, Math.min(0.30, kellyFraction)); // Increased cap from 0.25
    
    console.log(`[OPTIMIZED Kelly] 🚀 Enhanced Kelly - Raw: ${kellyFraction.toFixed(3)}, Adjusted: ${adjustedKelly.toFixed(3)}, Win Prob: ${winProbability.toFixed(3)}`);
    
    return adjustedKelly;
  }
  
  // OPTIMIZED: Enhanced confidence calculation
  private calculateOptimizedConfidence(features: any, marketContext: MarketContext): number {
    let confidence = 0.50; // Lowered base from 0.55

    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            confidence += 0.22; // Increased from 0.18
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            confidence += 0.12; // Increased from 0.08
            break;
        case 'SIDEWAYS_VOLATILE':
            confidence -= 0.06; // Reduced penalty from -0.10
            break;
        case 'SIDEWAYS_QUIET':
            confidence -= 0.03; // Reduced penalty from -0.05
            break;
    }
    
    confidence += (marketContext.liquidityScore - 0.5) * 0.30; // Increased from 0.25
    confidence += (marketContext.spreadQuality - 0.5) * 0.25; // Increased from 0.20
    
    const technicalStrength = Math.abs(features.technical);
    if (technicalStrength > 0.55) { // Lowered from 0.6
      confidence += 0.18; // Increased from 0.15
    } else if (technicalStrength > 0.35) { // Lowered from 0.4
      confidence += 0.12; // Increased from 0.10
    }
    
    if (Math.abs(features.orderbook_depth) > 0.4) { // Lowered from 0.5
      confidence += 0.15; // Increased from 0.12
    }
    
    return Math.max(0.20, Math.min(0.95, confidence)); // Expanded range
  }

  // OPTIMIZED: More aggressive market regime scoring
  private getOptimizedMarketRegimeScore(regime: MarketContext['marketRegime'], volatilityRegime: string): number {
    let baseScore = 0;
    
    switch (regime) {
      case 'STRONG_BULL': 
        baseScore = 0.9; // Increased from 0.8
        break;
      case 'WEAK_BULL': 
        baseScore = 0.5; // Increased from 0.4
        break;
      case 'STRONG_BEAR': 
        baseScore = -0.9; // More aggressive
        break;
      case 'WEAK_BEAR': 
        baseScore = 0.0; // Significantly increased from -0.2
        break;
      case 'SIDEWAYS_VOLATILE': 
        baseScore = 0.0; // Increased from -0.1
        break;
      case 'SIDEWAYS_QUIET': 
        baseScore = 0.2; // Increased from 0.1
        break;
      default: 
        baseScore = 0;
    }
    
    // Enhanced counter-trend detection
    if (regime === 'WEAK_BEAR' && volatilityRegime === 'LOW') {
      baseScore += 0.4; // Increased boost
      console.log(`[OPTIMIZED Regime] 🚀 Enhanced counter-trend boost for WEAK_BEAR + LOW volatility`);
    }
    
    return baseScore;
  }

  // OPTIMIZED: More aggressive volatility scoring
  private getOptimizedVolatilityScore(volatilityRegime: string, marketRegime: string): number {
    let baseScore = 0.5;
    
    switch (volatilityRegime) {
      case 'LOW': 
        baseScore = 0.5; // Increased from 0.4
        break;
      case 'MEDIUM': 
        baseScore = 0.7; // Increased from 0.6
        break;
      case 'HIGH': 
        baseScore = 0.9; // Increased from 0.8
        break;
    }
    
    if (volatilityRegime === 'LOW' && (marketRegime === 'WEAK_BEAR' || marketRegime === 'WEAK_BULL')) {
      baseScore += 0.3; // Increased boost
    }
    
    return baseScore;
  }

  // OPTIMIZED: Enhanced raw score calculation
  private calculateOptimizedRawScore(features: any, marketContext: MarketContext): number {
    let score = 0;
    
    const regimeMultipliers = this.getOptimizedRegimeMultipliers(marketContext);
    
    score += features.technical * this.modelWeights['technical'] * regimeMultipliers.technical;
    score += features.momentum * this.modelWeights['momentum'] * regimeMultipliers.momentum;
    score += features.volatility * this.modelWeights['volatility_regime'] * regimeMultipliers.volatility;
    score += features.market_structure * this.modelWeights['market_structure'] * regimeMultipliers.market_structure;
    score += features.orderbook_depth * this.modelWeights['orderbook_depth'] * regimeMultipliers.orderbook;
    
    // More aggressive performance bias
    const recentWinRate = this.getRecentWinRate();
    const performanceBias = (recentWinRate - 0.5) * 0.15; // Increased from 0.10
    score += performanceBias;
    
    // Enhanced opportunity boost
    if (this.detectOptimizedMarketOpportunity(features, marketContext)) {
      score += 0.20; // Increased from 0.15
      console.log(`[OPTIMIZED AI] 🚀 Enhanced market opportunity boost applied: +0.20`);
    }
    
    console.log(`[OPTIMIZED AI] 📊 Enhanced raw score: ${score.toFixed(3)}, Performance bias: ${performanceBias.toFixed(3)}`);
    
    return score;
  }

  // OPTIMIZED: More aggressive regime multipliers
  private getOptimizedRegimeMultipliers(marketContext: MarketContext) {
    const regime = marketContext.marketRegime;
    const volatility = marketContext.volatilityRegime;
    
    let multipliers = {
      technical: 1.0,
      momentum: 1.0,
      volatility: 1.0,
      market_structure: 1.0,
      orderbook: 1.0
    };
    
    switch (regime) {
      case 'WEAK_BEAR':
        if (volatility === 'LOW') {
          multipliers.momentum = 1.5; // Increased from 1.3
          multipliers.technical = 1.4; // Increased from 1.2
          console.log(`[OPTIMIZED Regime] 🚀 Applying enhanced WEAK_BEAR + LOW volatility multipliers`);
        }
        break;
      case 'SIDEWAYS_VOLATILE':
        multipliers.orderbook = 1.6; // Increased from 1.4
        multipliers.technical = 0.9; // Less aggressive reduction
        break;
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        multipliers.momentum = 1.4; // Increased from 1.2
        break;
    }
    
    return multipliers;
  }

  // OPTIMIZED: Enhanced opportunity detection
  private detectOptimizedMarketOpportunity(features: any, marketContext: MarketContext): boolean {
    const now = Date.now();
    
    const technicalStrength = Math.abs(features.technical);
    const momentumStrength = Math.abs(features.momentum);
    const orderbookStrength = Math.abs(features.orderbook_depth);
    
    // More aggressive thresholds
    const hasStrongConfluence = technicalStrength > 0.5 && momentumStrength > 0.4 && orderbookStrength > 0.3;
    
    // More permissive market conditions
    const hasGoodLiquidity = marketContext.liquidityScore > 0.2; // Lowered from 0.3
    const hasGoodSpread = marketContext.spreadQuality > 0.4;    // Lowered from 0.5
    
    const isOpportunity = hasStrongConfluence && hasGoodLiquidity && hasGoodSpread;
    
    if (isOpportunity && !this.marketOpportunityState.isInOpportunityWindow) {
      this.marketOpportunityState.isInOpportunityWindow = true;
      this.marketOpportunityState.opportunityStartTime = now;
      console.log(`[OPTIMIZED Opportunity] 🚀 Enhanced market opportunity window opened`);
    } else if (!isOpportunity && this.marketOpportunityState.isInOpportunityWindow) {
      this.marketOpportunityState.isInOpportunityWindow = false;
      console.log(`[OPTIMIZED Opportunity] 🚪 Market opportunity window closed`);
    }
    
    return isOpportunity;
  }

  // OPTIMIZED: More aggressive sigmoid activation
  private optimizedSigmoidActivation(x: number): number {
    const slope = 1.8; // Increased from 1.5
    const offset = 0.03; // Increased from 0.02
    return (1 / (1 + Math.exp(-x * slope))) + offset;
  }

  private calculateFeatureContributions(features: any, marketContext: MarketContext): { [key: string]: number } {
    const regimeMultipliers = this.getOptimizedRegimeMultipliers(marketContext);
    
    return {
      technical: features.technical * this.modelWeights['technical'] * regimeMultipliers.technical,
      momentum: features.momentum * this.modelWeights['momentum'] * regimeMultipliers.momentum,
      volatility: features.volatility * this.modelWeights['volatility_regime'] * regimeMultipliers.volatility,
      market_structure: features.market_structure * this.modelWeights['market_structure'] * regimeMultipliers.market_structure,
      orderbook_depth: features.orderbook_depth * this.modelWeights['orderbook_depth'] * regimeMultipliers.orderbook
    };
  }

  // OPTIMIZED: Enhanced signal tracking
  private trackOptimizedSignalGeneration(signalGenerated: boolean): void {
    const now = Date.now();
    
    if (signalGenerated) {
      this.signalMetrics.lastSignalTime = now;
      this.signalMetrics.totalSignalsGenerated++;
      this.signalMetrics.signalDroughtCount = 0;
      this.signalMetrics.consecutiveNoSignals = 0;
      
      this.signalMetrics.signalsInLastHour++;
      
      console.log(`[OPTIMIZED Signal Tracking] ✅ Signal generated. Total: ${this.signalMetrics.totalSignalsGenerated}, Last hour: ${this.signalMetrics.signalsInLastHour}`);
    } else {
      this.signalMetrics.consecutiveNoSignals++;
      
      if (this.signalMetrics.consecutiveNoSignals % 8 === 0) { // More frequent warnings
        console.log(`[OPTIMIZED Signal Tracking] ⚠️ ${this.signalMetrics.consecutiveNoSignals} consecutive no-signals`);
      }
    }
    
    if (this.signalMetrics.totalSignalsGenerated > 1) {
      const timeSinceStart = now - (this.signalMetrics.lastSignalTime - (this.signalMetrics.totalSignalsGenerated * 45000)); // Adjusted estimate
      this.signalMetrics.avgTimeBetweenSignals = timeSinceStart / this.signalMetrics.totalSignalsGenerated;
    }
  }

  private trackOptimizedPredictionAccuracy(outcome: TradeOutcome): void {
    const prediction = outcome.prediction;
    const actualSuccess = outcome.success;
    const predictedSuccess = prediction.probability > 0.5;
    
    const accuracyMatch = actualSuccess === predictedSuccess;
    
    console.log(`[OPTIMIZED Accuracy] 📊 Prediction vs Reality - Predicted: ${predictedSuccess}, Actual: ${actualSuccess}, Match: ${accuracyMatch}`);
    console.log(`[OPTIMIZED Accuracy] 📈 Expected: ${prediction.expectedReturn.toFixed(2)}%, Actual: ${outcome.actualReturn.toFixed(2)}%`);
    console.log(`[OPTIMIZED Accuracy] 🎯 MAE prediction: ${prediction.maxAdverseExcursion.toFixed(2)}%, Actual: ${outcome.maxAdverseExcursion.toFixed(2)}%`);
  }

  // OPTIMIZED: More aggressive Kelly threshold updates
  private updateEnhancedKellyThreshold(): void {
    if (this.trainingData.length < 10) return; // Reduced from 15
    
    const recentWinRate = this.getRecentWinRate();
    const profitFactor = this.performanceMetrics.profitFactor;
    const avgKelly = this.trainingData.slice(-15).reduce((sum, t) => sum + t.prediction.kellyFraction, 0) / 15;
    
    console.log(`[OPTIMIZED Kelly] 📊 Recent metrics - Win rate: ${recentWinRate.toFixed(3)}, Profit factor: ${profitFactor.toFixed(2)}, Avg Kelly: ${avgKelly.toFixed(3)}`);
    
    // More aggressive adjustments
    if (recentWinRate > 0.55 && profitFactor > 1.15) { // Lowered thresholds
      this.adaptiveThresholds.kellyThreshold = Math.min(0.20, this.adaptiveThresholds.kellyThreshold * 1.25); // More aggressive
      console.log(`[OPTIMIZED Kelly] ⬆️ Increasing Kelly threshold to ${this.adaptiveThresholds.kellyThreshold.toFixed(3)}`);
    } else if (recentWinRate < 0.45 || profitFactor < 0.95) { // More permissive
      this.adaptiveThresholds.kellyThreshold = Math.max(0.005, this.adaptiveThresholds.kellyThreshold * 0.80); // More aggressive
      console.log(`[OPTIMIZED Kelly] ⬇️ Decreasing Kelly threshold to ${this.adaptiveThresholds.kellyThreshold.toFixed(3)}`);
    }
  }

  // OPTIMIZED: More aggressive risk scoring
  private calculateOptimizedRiskScore(input: PredictionInput): number {
    let risk = 0.20; // Lowered base from 0.25

    switch (input.marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            risk -= 0.08; // Increased reduction from -0.06
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            risk -= 0.03; // Increased reduction from -0.01
            break;
        case 'SIDEWAYS_VOLATILE':
            risk += 0.12; // Reduced penalty from +0.15
            break;
        case 'SIDEWAYS_QUIET':
            risk += 0.03; // Reduced penalty from +0.05
            break;
    }
    
    if (input.marketContext.volatilityRegime === 'HIGH') {
      risk += 0.06; // Reduced from 0.08
    } else if (input.marketContext.volatilityRegime === 'LOW') {
      risk -= 0.03; // Increased reduction from -0.01
    }
    
    // More favorable liquidity adjustments
    risk -= (input.marketContext.liquidityScore - 0.5) * 0.25; // Increased from 0.20
    risk -= (input.marketContext.spreadQuality - 0.5) * 0.20;  // Increased from 0.15
    
    // Less RSI penalty
    if (input.indicators.rsi_14 < 25 || input.indicators.rsi_14 > 75) {
      risk += 0.03; // Reduced from 0.05
    }
    
    if (Math.abs(input.orderBookImbalance) > 0.6) {
      risk += 0.02; // Reduced from 0.03
    }
    
    return Math.max(0.03, Math.min(0.85, risk)); // Expanded favorable range
  }

  private estimateExpectedReturn(probability: number, confidence: number, indicators: AdvancedIndicators, marketContext: MarketContext): number {
    if (indicators.bollinger_middle <= 0) {
        return 0.12; // Slightly increased from 0.1
    }

    const bandRange = indicators.bollinger_upper - indicators.bollinger_lower;
    const potentialReturnPercent = (bandRange / indicators.bollinger_middle) * 100;
    
    let regimeMultiplier = 1.0;
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            regimeMultiplier = 1.3; // Increased from 1.2
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            regimeMultiplier = 1.1; // Increased from 1.05
            break;
        case 'SIDEWAYS_VOLATILE':
            regimeMultiplier = 0.9; // Increased from 0.85
            break;
        case 'SIDEWAYS_QUIET':
            regimeMultiplier = 0.75; // Increased from 0.7
            break;
    }
    
    const volatilityMultiplier = marketContext.volatilityRegime === 'HIGH' ? 1.15 : 
                                marketContext.volatilityRegime === 'LOW' ? 0.95 : 1.0;
    
    const liquidityMultiplier = 0.8 + (marketContext.liquidityScore * 0.4);
    
    const baseReturn = potentialReturnPercent * 0.3; // Increased from 0.25
    const adjustedReturn = baseReturn * regimeMultiplier * volatilityMultiplier * liquidityMultiplier;
    const finalReturn = adjustedReturn * confidence * Math.abs(probability - 0.5) * 4;
    
    return Math.max(0.06, Math.min(2.0, finalReturn)); // Slightly increased range
  }
  
  private estimateOptimalTimeHorizon(marketContext: MarketContext, indicators: AdvancedIndicators): number {
    let baseTime = 50; // Reduced from 60 for faster trades
    
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            baseTime *= 0.6; // Reduced from 0.7
            break;
        case 'SIDEWAYS_VOLATILE':
            baseTime *= 1.2; // Reduced from 1.4
            break;
        case 'SIDEWAYS_QUIET':
            baseTime *= 1.5; // Reduced from 1.8
            break;
    }
    
    baseTime *= (1.4 - marketContext.liquidityScore * 0.4); // Reduced multiplier
    
    if (marketContext.volatilityRegime === 'HIGH') {
      baseTime *= 0.5; // Reduced from 0.6
    } else if (marketContext.volatilityRegime === 'LOW') {
      baseTime *= 1.2; // Reduced from 1.3
    }
    
    baseTime *= (1 + indicators.trend_strength / 500); // Reduced impact
    
    return Math.max(15, Math.min(150, baseTime)); // Reduced range
  }

  private updateOptimizedPerformanceMetrics() {
    if (this.trainingData.length === 0) return;
    
    const recentTrades = this.trainingData.slice(-40); // Reduced from -50
    const successfulTrades = recentTrades.filter(t => t.success);
    
    this.performanceMetrics.winRate = successfulTrades.length / recentTrades.length;
    this.performanceMetrics.totalTrades = this.trainingData.length;
    
    const returns = recentTrades.map(t => t.actualReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    this.performanceMetrics.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    this.performanceMetrics.avgMAE = recentTrades.reduce((sum, t) => sum + t.maxAdverseExcursion, 0) / recentTrades.length;
    this.performanceMetrics.avgMFE = recentTrades.reduce((sum, t) => sum + t.maxFavorableExcursion, 0) / recentTrades.length;
    
    const grossProfit = recentTrades.filter(t => t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    const grossLoss = recentTrades.filter(t => !t.success).reduce((sum, t) => sum + Math.abs(t.actualReturn), 0);
    this.performanceMetrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 1.0;
    
    console.log(`[OPTIMIZED AI] 📊 Performance metrics - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}, Avg MAE: ${this.performanceMetrics.avgMAE.toFixed(3)}%`);
  }

  private adaptOptimizedThresholdsBasedOnPerformance() {
    if (this.trainingData.length < 8) return; // Reduced from 10
    
    const recentTrades = this.trainingData.slice(-15); // Reduced from -20
    const winRate = recentTrades.filter(t => t.success).length / recentTrades.length;
    const profitFactor = this.performanceMetrics.profitFactor;
    
    // More aggressive threshold adaptation
    if (winRate > 0.50 && profitFactor > 1.10) { // Lowered thresholds
      this.adaptiveThresholds.minProbability = Math.min(0.50, this.adaptiveThresholds.minProbability + 0.012); // More aggressive
      this.adaptiveThresholds.minConfidence = Math.min(0.40, this.adaptiveThresholds.minConfidence + 0.012);
    } else if (winRate < 0.45 || profitFactor < 0.95) { // More permissive
      this.adaptiveThresholds.minProbability = Math.max(0.40, this.adaptiveThresholds.minProbability - 0.015); // More aggressive
      this.adaptiveThresholds.minConfidence = Math.max(0.18, this.adaptiveThresholds.minConfidence - 0.015);
    }
    
    const avgRisk = recentTrades.reduce((sum, t) => sum + t.prediction.riskScore, 0) / recentTrades.length;
    if (winRate > 0.48 && avgRisk < 0.50) { // Lowered thresholds
      this.adaptiveThresholds.maxRiskScore = Math.min(0.90, this.adaptiveThresholds.maxRiskScore + 0.03); // More aggressive
    } else if (winRate < 0.45) {
      this.adaptiveThresholds.maxRiskScore = Math.max(0.70, this.adaptiveThresholds.maxRiskScore - 0.03); // More aggressive
    }
  }

  private retrainOptimizedModelWithRegimeAwareness() {
    if (this.trainingData.length < 15) return; // Reduced from 20
    
    const recentTrades = this.trainingData.slice(-30); // Reduced from -40
    const learningRate = 0.04; // Increased from 0.03
    
    const successfulTrades = recentTrades.filter(t => t.success);
    const failedTrades = recentTrades.filter(t => !t.success);
    
    if (successfulTrades.length > 0 && failedTrades.length > 0) {
      const successFeatures = this.analyzeFeaturePerformance(successfulTrades);
      const failFeatures = this.analyzeFeaturePerformance(failedTrades);
      
      Object.keys(this.modelWeights).forEach(key => {
        const successAvg = successFeatures[key] || 0;
        const failAvg = failFeatures[key] || 0;
        const importance = Math.abs(successAvg - failAvg);
        
        if (importance > 0.15) { // Lowered from 0.2
          this.modelWeights[key] *= (1 + learningRate * 2.0); // More aggressive
        } else if (importance < 0.06) { // Lowered from 0.08
          this.modelWeights[key] *= (1 - learningRate * 0.8);
        }
        
        this.modelWeights[key] = Math.max(0.05, Math.min(0.50, this.modelWeights[key])); // Increased max
      });
      
      const totalWeight = Object.values(this.modelWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(this.modelWeights).forEach(key => {
        this.modelWeights[key] /= totalWeight;
      });
    }
    
    console.log(`[OPTIMIZED AI] 🎓 Enhanced retraining completed - Win rate: ${this.performanceMetrics.winRate.toFixed(3)}, Profit factor: ${this.performanceMetrics.profitFactor.toFixed(2)}`);
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
    if (this.trainingData.length < 3) return 0.5; // Reduced from 5
    const recent = this.trainingData.slice(-10); // Reduced from -15
    return recent.filter(t => t.success).length / recent.length;
  }

  private estimateMAE(indicators: AdvancedIndicators, marketContext: MarketContext): number {
    let baseMAE = 0.4; // Reduced from 0.5
    
    const atrPercent = indicators.bollinger_middle > 0 ? 
      (indicators.atr / indicators.bollinger_middle) * 100 : 0.4;
    
    baseMAE = Math.max(0.25, Math.min(1.8, atrPercent * 0.75)); // More optimistic
    
    switch (marketContext.marketRegime) {
      case 'SIDEWAYS_VOLATILE':
        baseMAE *= 1.3; // Reduced from 1.5
        break;
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        baseMAE *= 0.75; // Reduced from 0.8
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
    return Math.min(width * 12, 1); // Increased sensitivity
  }
  
  private calculateSRStrength(indicators: AdvancedIndicators): number {
    const range = indicators.resistance_level - indicators.support_level;
    const currentPrice = (indicators.support_level + indicators.resistance_level) / 2;
    if (currentPrice <= 0) return 0;
    return Math.min(range / currentPrice, 0.04) * 25; // Increased sensitivity
  }
  
  private getMarketHourScore(hour: string): number {
    switch (hour) {
      case 'OVERLAP': return 1.0;
      case 'NEW_YORK': return 0.9;
      case 'LONDON': return 0.8;
      case 'ASIA': return 0.7;
      case 'LOW_LIQUIDITY': return 0.5; // Increased from 0.4
      default: return 0.6; // Increased from 0.5
    }
  }
}
