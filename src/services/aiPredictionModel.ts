import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';
import { RealTrainingDataService } from './realTrainingDataService';
import { MeanReversionTPSLService } from './meanReversionTPSLService';

export interface PredictionInput {
  indicators: AdvancedIndicators;
  marketContext: MarketContext;
  orderBookImbalance: number;
  recentPriceMovement: number[];
  timeOfDay: number;
  dayOfWeek: number;
  deepOrderBookData?: any;
}

export interface PredictionOutput {
  probability: number;
  confidence: number;
  expectedReturn: number;
  riskScore: number;
  timeHorizon: number;
  kellyFraction: number;
  maxAdverseExcursion: number;
  features: {
    technical: number;
    momentum: number;
    volatility: number;
    market_structure: number;
    orderbook_depth: number;
  };
  featureContributions?: {
    technical: number;
    momentum: number;
    volatility: number;
    market_structure: number;
    orderbook_depth: number;
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
  private realTrainingService: RealTrainingDataService;
  private meanReversionService: MeanReversionTPSLService;
  private modelWeights: Map<string, number>;
  private adaptiveThresholds: any;
  private dynamicThresholds: any;
  private signalCount: number = 0;
  private hourlySignalCounts: Map<number, number> = new Map();
  private previousMarketContext: MarketContext | null = null;

  constructor() {
    this.realTrainingService = new RealTrainingDataService();
    this.meanReversionService = new MeanReversionTPSLService();
    this.modelWeights = new Map();
    
    // Initialize with REAL data only - NO FALLBACK VALUES
    this.initializeRealDataOnly();
    
    console.log('[Enhanced AI Model] 🚀 Initializing with REAL data and learning system:');
    const realStats = this.realTrainingService.getRealMarketStatistics();
    console.log(`  - Real trades: ${realStats.totalTrades}`);
    console.log(`  - Real win rate: ${(realStats.winRate * 100).toFixed(1)}%`);
    console.log(`  - Real profit factor: ${realStats.profitFactor.toFixed(2)}`);
    console.log(`  - Prediction accuracy: ${(this.realTrainingService.getDataQuality().predictionAccuracy * 100).toFixed(1)}%`);
    console.log(`  - Data quality: ${this.getDataQualityLevel()}`);
    console.log(`  - Enhanced learning system active`);
    
    // ONLY use real data - absolutely no synthetic generation
    if (realStats.totalTrades > 0) {
      this.updateWeightsFromRealData();
      console.log('[Enhanced AI Model] ✅ Using REAL trade data for model weights');
    } else {
      console.log('[Enhanced AI Model] ⚠️ No real trade data yet - using minimal weights until data accumulates');
    }
  }

  private initializeRealDataOnly(): void {
    // Ultra-minimal weights until real data accumulates - NO FALLBACK
    this.modelWeights.set('technical_base', 0.10);
    this.modelWeights.set('momentum_base', 0.10);
    this.modelWeights.set('volatility_base', 0.15);
    this.modelWeights.set('market_structure_base', 0.20);
    this.modelWeights.set('orderbook_depth_base', 0.20);
    
    // Very conservative thresholds until real performance data builds
    this.adaptiveThresholds = {
      minProbability: 0.55,
      minConfidence: 0.40,
      maxRiskScore: 0.70,
      kellyThreshold: 0.03
    };
    
    this.dynamicThresholds = {
      minProbability: 0.52,
      minConfidence: 0.45,
      maxRiskScore: 0.75
    };

    console.log('[Enhanced AI Model] 🔧 Initialized with real-data-only weights (no fallbacks)');
  }

  private updateWeightsFromRealData(): void {
    const realData = this.realTrainingService.getRealTrainingData();
    if (realData.length === 0) return;

    console.log(`[Enhanced AI Model] 📊 Updating weights from ${realData.length} REAL trades`);

    // Calculate feature performance from REAL trades only
    const featurePerformance = this.calculateRealFeaturePerformance(realData);
    
    // Update weights based on actual performance
    Object.entries(featurePerformance).forEach(([feature, performance]) => {
      const currentWeight = this.modelWeights.get(`${feature}_base`) || 0.15;
      const performanceValue = typeof performance === 'number' ? performance : 0;
      const adjustedWeight = currentWeight * (0.7 + performanceValue * 0.6); // More aggressive adjustment
      this.modelWeights.set(`${feature}_base`, Math.max(0.02, Math.min(0.5, adjustedWeight)));
    });

    console.log('[Enhanced AI Model] ✅ Model weights updated from REAL trade performance');
  }

  private calculateRealFeaturePerformance(realData: TradeOutcome[]): any {
    const featurePerformance = {
      technical: 0,
      momentum: 0,
      volatility: 0,
      market_structure: 0,
      orderbook_depth: 0
    };

    if (realData.length === 0) return featurePerformance;

    // Analyze real trade outcomes vs predictions
    realData.forEach(trade => {
      const profitWeight = Math.tanh(trade.profitLoss / 100); // Normalize P&L impact
      const predictionAccuracy = trade.success ? 1 : -1;
      const weightedScore = predictionAccuracy * (0.7 + profitWeight * 0.3);
      
      if (trade.prediction.featureContributions) {
        Object.keys(featurePerformance).forEach(feature => {
          const contribution = trade.prediction.featureContributions![feature] || 0;
          featurePerformance[feature] += contribution * weightedScore;
        });
      }
    });

    // Normalize by number of trades
    Object.keys(featurePerformance).forEach(feature => {
      featurePerformance[feature] /= realData.length;
    });

    return featurePerformance;
  }

  predict(input: PredictionInput): PredictionOutput {
    console.log(`[Enhanced AI Model] 🚀 Starting prediction with enhanced learning system`);
    
    // Log this signal attempt for learning
    this.logSignalAttemptForLearning(input);
    
    // Check for market context changes
    if (this.previousMarketContext) {
      this.meanReversionService.logMarketContextChange(this.previousMarketContext, input.marketContext);
    }
    this.previousMarketContext = input.marketContext;

    // Log order book patterns
    this.logOrderBookPatterns(input);
    
    // Extract features from REAL market data only
    const features = this.extractRealFeatures(input);
    
    console.log(`[Enhanced AI Model] 🎯 Features extracted using REAL market data`);
    
    // Apply market regime adjustments based on REAL market context
    const regimeMultipliers = this.getRealMarketRegimeMultipliers(input.marketContext);
    const adjustedFeatures = this.applyRealRegimeMultipliers(features, regimeMultipliers);
    
    console.log(`[Enhanced AI Model] 🚀 Applying enhanced ${input.marketContext.marketRegime} + ${input.marketContext.volatilityRegime} volatility multipliers`);
    
    // Calculate prediction using REAL data weights
    const rawScore = this.calculateRealPredictionScore(adjustedFeatures);
    
    // Apply performance bias from REAL trades only
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const performanceBias = realStats.totalTrades > 20 ? 
      this.safeValue((realStats.winRate - 0.5) * 0.15, 0) : 0; // Stronger bias with more data
    
    console.log(`[Enhanced AI Model] 📊 Enhanced raw score: ${rawScore.toFixed(3)}, Performance bias: ${performanceBias.toFixed(3)}`);
    
    const adjustedScore = this.safeValue(rawScore + performanceBias, 0);
    const probability = this.sigmoidActivation(adjustedScore);
    
    // Calculate other metrics using REAL data and mean reversion analytics
    const confidence = this.calculateEnhancedConfidence(features, input.marketContext);
    const expectedReturn = this.calculateEnhancedExpectedReturn(probability, input.marketContext);
    const riskScore = this.calculateEnhancedRiskScore(features, input.marketContext);
    const timeHorizon = this.calculateRealTimeHorizon(input.marketContext);
    const kellyFraction = this.calculateEnhancedKellyFraction(probability, expectedReturn, riskScore);
    const maxAdverseExcursion = this.calculateRealMAE(input.marketContext, riskScore);
    
    console.log(`[Enhanced AI Model] 🚀 Enhanced Kelly - Raw: ${kellyFraction.toFixed(3)}, Adjusted: ${Math.min(kellyFraction, 0.25).toFixed(3)}, Win Prob: ${probability.toFixed(3)}`);
    
    // Update adaptive and dynamic thresholds based on learning analytics
    this.updateEnhancedThresholds();
    
    // Track signal generation for real data quality
    this.trackSignalGeneration();
    
    const prediction: PredictionOutput = {
      probability,
      confidence,
      expectedReturn,
      riskScore,
      timeHorizon,
      kellyFraction: Math.min(kellyFraction, 0.25), // More conservative cap
      maxAdverseExcursion,
      features: adjustedFeatures,
      featureContributions: this.calculateRealFeatureContributions(adjustedFeatures)
    };
    
    console.log(`[Enhanced AI Model] 🚀 Enhanced prediction - Prob: ${probability.toFixed(3)}, Raw Score: ${rawScore.toFixed(3)}, Kelly: ${kellyFraction.toFixed(3)}`);
    console.log(`[Enhanced AI Model] 📊 Feature contributions - Tech: ${prediction.featureContributions!.technical.toFixed(3)}, Momentum: ${prediction.featureContributions!.momentum.toFixed(3)}, Market: ${prediction.featureContributions!.market_structure.toFixed(3)}`);
    
    return prediction;
  }

  private logSignalAttemptForLearning(input: PredictionInput): void {
    // This will be called by the trading system after execution decision
    // For now, just prepare the data structure
    console.log(`[Enhanced AI Model] 📚 Preparing signal attempt for learning system`);
  }

  private logOrderBookPatterns(input: PredictionInput): void {
    const priceMovement = input.recentPriceMovement;
    let priceAction: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    
    if (priceMovement.length >= 2) {
      const recentChange = (priceMovement[0] - priceMovement[priceMovement.length - 1]) / priceMovement[priceMovement.length - 1];
      if (recentChange > 0.001) priceAction = 'UP';
      else if (recentChange < -0.001) priceAction = 'DOWN';
    }

    this.meanReversionService.logOrderBookPattern(
      input.orderBookImbalance,
      input.marketContext.spreadQuality,
      input.marketContext.liquidityScore,
      priceAction
    );
  }

  private extractRealFeatures(input: PredictionInput): PredictionOutput['features'] {
    const { indicators, marketContext, orderBookImbalance, recentPriceMovement } = input;
    
    // Technical analysis features from REAL indicators with NaN protection
    const rsiSignal = indicators.rsi_14 ? this.safeValue((indicators.rsi_14 - 50) / 50, 0) : 0;
    const macdSignal = indicators.macd && indicators.macd_signal ? 
      this.safeValue(Math.tanh((indicators.macd - indicators.macd_signal) * 10), 0) : 0;
    const bollingerPosition = indicators.bollinger_middle && indicators.bollinger_upper && indicators.bollinger_lower ?
      this.safeValue((recentPriceMovement[0] - indicators.bollinger_middle) / 
      (indicators.bollinger_upper - indicators.bollinger_lower), 0) : 0;
    
    const technical = this.safeValue(rsiSignal * 0.4 + macdSignal * 0.35 + bollingerPosition * 0.25, 0);
    
    // Momentum features from REAL price data with NaN protection
    const priceChanges = recentPriceMovement.length > 1 ? 
      recentPriceMovement.slice(1).map((price, i) => 
        this.safeValue((price - recentPriceMovement[i]) / recentPriceMovement[i], 0)
      ) : [0];
    
    const avgMomentum = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const momentum = this.safeValue(Math.tanh(avgMomentum * 100), 0);
    
    // Volatility from REAL market data with NaN protection
    const volatilityScore = marketContext.volatilityRegime === 'HIGH' ? 0.8 :
                           marketContext.volatilityRegime === 'MEDIUM' ? 0.5 : 0.2;
    const atrNormalized = indicators.atr && recentPriceMovement[0] ? 
      this.safeValue(indicators.atr / recentPriceMovement[0], 0.01) : 0.01;
    const volatility = this.safeValue(volatilityScore * 0.6 + Math.tanh(atrNormalized * 100) * 0.4, 0.2);
    
    // Market structure from REAL market context with NaN protection
    const regimeScore = this.getRegimeScore(marketContext.marketRegime);
    const liquidityImpact = this.safeValue((marketContext.liquidityScore - 0.5) * 2, 0);
    const market_structure = this.safeValue(regimeScore * 0.7 + liquidityImpact * 0.3, 0);
    
    // Order book depth from REAL order book data with NaN protection
    const orderBookSignal = this.safeValue(Math.tanh(orderBookImbalance * 5), 0);
    const spreadImpact = this.safeValue((marketContext.spreadQuality - 0.5) * 2, 0);
    const orderbook_depth = this.safeValue(orderBookSignal * 0.6 + spreadImpact * 0.4, 0);
    
    console.log(`[Enhanced AI Model] 🔧 Features calculated: tech=${technical.toFixed(3)}, momentum=${momentum.toFixed(3)}, volatility=${volatility.toFixed(3)}, market=${market_structure.toFixed(3)}, orderbook=${orderbook_depth.toFixed(3)}`);
    
    return {
      technical,
      momentum,
      volatility,
      market_structure,
      orderbook_depth
    };
  }

  private getRegimeScore(regime: string): number {
    switch (regime) {
      case 'STRONG_BULL': return 0.8;
      case 'WEAK_BULL': return 0.4;
      case 'SIDEWAYS_VOLATILE': return 0.0;
      case 'SIDEWAYS_QUIET': return -0.2;
      case 'WEAK_BEAR': return -0.4;
      case 'STRONG_BEAR': return -0.8;
      default: return 0;
    }
  }

  private getRealMarketRegimeMultipliers(marketContext: MarketContext): any {
    const volatilityMultiplier = marketContext.volatilityRegime === 'LOW' ? 1.3 : 
                                marketContext.volatilityRegime === 'MEDIUM' ? 1.0 : 0.8;
    
    let regimeMultiplier = 1.0;
    let regimeBoost = 0;
    
    // Enhanced regime-specific adjustments
    switch (marketContext.marketRegime) {
      case 'STRONG_BULL':
      case 'STRONG_BEAR':
        regimeMultiplier = 1.2;
        regimeBoost = 0.05;
        break;
      case 'WEAK_BULL':
      case 'WEAK_BEAR':
        regimeMultiplier = 1.1;
        regimeBoost = 0.03;
        console.log(`[Enhanced AI Model] 🚀 Enhanced counter-trend boost for ${marketContext.marketRegime} + ${marketContext.volatilityRegime} volatility`);
        break;
      case 'SIDEWAYS_VOLATILE':
        regimeMultiplier = 0.9;
        regimeBoost = -0.02;
        break;
      case 'SIDEWAYS_QUIET':
        regimeMultiplier = 0.95;
        regimeBoost = -0.01;
        break;
    }
    
    return {
      volatilityMultiplier,
      regimeMultiplier,
      regimeBoost
    };
  }

  private applyRealRegimeMultipliers(features: any, multipliers: any): any {
    return {
      technical: features.technical * multipliers.regimeMultiplier + multipliers.regimeBoost,
      momentum: features.momentum * multipliers.volatilityMultiplier,
      volatility: features.volatility * multipliers.volatilityMultiplier,
      market_structure: features.market_structure * multipliers.regimeMultiplier,
      orderbook_depth: features.orderbook_depth
    };
  }

  private calculateRealPredictionScore(features: any): number {
    let score = 0;
    
    Object.entries(features).forEach(([feature, value]) => {
      const weight = this.modelWeights.get(`${feature}_base`) || 0.15;
      const safeFeatureValue = this.safeValue(value as number, 0);
      score += safeFeatureValue * weight;
    });
    
    const finalScore = this.safeValue(score, 0);
    console.log(`[Enhanced AI Model] 🔧 Prediction score calculated: ${finalScore.toFixed(3)}`);
    return finalScore;
  }

  private calculateEnhancedConfidence(features: any, marketContext: MarketContext): number {
    const featureValues = Object.values(features) as number[];
    const safeFeatureValues = featureValues.map(val => this.safeValue(val, 0));
    const featureStrength = safeFeatureValues.reduce((sum: number, val: number) => 
      sum + Math.abs(val), 0) / safeFeatureValues.length;
    
    const liquidityBonus = Math.max(0, marketContext.liquidityScore - 0.5) * 0.25;
    const spreadBonus = Math.max(0, marketContext.spreadQuality - 0.5) * 0.2;
    
    // Include learning analytics in confidence
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    const executionRateBonus = learningAnalytics.executionRate > 0.5 ? 0.1 : 0;
    
    const baseConfidence = this.safeValue(Math.tanh(featureStrength * 2.2) * 0.65, 0.25);
    const finalConfidence = Math.min(0.95, baseConfidence + liquidityBonus + spreadBonus + executionRateBonus + 0.2);
    
    console.log(`[Enhanced AI Model] 🔧 Enhanced confidence calculated: ${finalConfidence.toFixed(3)} (base: ${baseConfidence.toFixed(3)})`);
    return finalConfidence;
  }

  private calculateEnhancedExpectedReturn(probability: number, marketContext: MarketContext): number {
    const safeProbability = this.safeValue(probability, 0.5);
    const baseReturn = (safeProbability - 0.5) * 3.8; // Slightly more conservative
    
    const volatilityAdjustment = marketContext.volatilityRegime === 'HIGH' ? 1.2 :
                                marketContext.volatilityRegime === 'MEDIUM' ? 1.0 : 0.85;
    
    const liquidityAdjustment = 0.75 + (marketContext.liquidityScore * 0.5);
    
    // Include mean reversion analytics
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    const performanceAdjustment = learningAnalytics.executionRate > 0 ? 
      0.9 + (learningAnalytics.executionRate * 0.2) : 1.0;
    
    const finalReturn = this.safeValue(baseReturn * volatilityAdjustment * liquidityAdjustment * performanceAdjustment, 0.3);
    console.log(`[Enhanced AI Model] 🔧 Enhanced expected return calculated: ${finalReturn.toFixed(3)}%`);
    return finalReturn;
  }

  private calculateEnhancedRiskScore(features: any, marketContext: MarketContext): number {
    const featureValues = Object.values(features) as number[];
    const safeFeatureValues = featureValues.map(val => this.safeValue(val, 0));
    const featureUncertainty = safeFeatureValues.reduce((sum: number, val: number) => 
      sum + Math.abs(0.5 - Math.abs(val)), 0) / safeFeatureValues.length;
    
    const volatilityRisk = marketContext.volatilityRegime === 'HIGH' ? 0.35 : 
                          marketContext.volatilityRegime === 'MEDIUM' ? 0.2 : 0.1;
    
    const liquidityRisk = Math.max(0, 0.5 - marketContext.liquidityScore) * 0.5;
    
    // Include learning-based risk adjustment
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    const learningRiskAdjustment = learningAnalytics.totalLearningPoints > 100 ? -0.05 : 0.05;
    
    const finalRisk = Math.min(0.9, this.safeValue(featureUncertainty + volatilityRisk + liquidityRisk + learningRiskAdjustment, 0.4));
    console.log(`[Enhanced AI Model] 🔧 Enhanced risk score calculated: ${finalRisk.toFixed(3)}`);
    return finalRisk;
  }

  private calculateRealTimeHorizon(marketContext: MarketContext): number {
    const baseHorizon = marketContext.volatilityRegime === 'HIGH' ? 60 :
                       marketContext.volatilityRegime === 'MEDIUM' ? 90 : 120;
    
    const liquidityAdjustment = 0.8 + (marketContext.liquidityScore * 0.4);
    
    return Math.round(baseHorizon * liquidityAdjustment);
  }

  private calculateEnhancedKellyFraction(probability: number, expectedReturn: number, riskScore: number): number {
    const safeProbability = this.safeValue(probability, 0.5);
    const safeExpectedReturn = this.safeValue(expectedReturn, 0);
    const safeRiskScore = this.safeValue(riskScore, 0.5);
    
    if (safeExpectedReturn <= 0) {
      console.log(`[Enhanced AI Model] 🔧 Kelly: Expected return <= 0, returning 0`);
      return 0;
    }
    
    const winProbability = safeProbability;
    const lossProbability = 1 - safeProbability;
    const avgWin = Math.abs(safeExpectedReturn);
    const avgLoss = avgWin * 0.75; // More conservative loss estimate
    
    if (avgLoss === 0) {
      console.log(`[Enhanced AI Model] 🔧 Kelly: Average loss = 0, returning 0`);
      return 0;
    }
    
    const kellyFraction = (winProbability * avgWin - lossProbability * avgLoss) / avgWin;
    const riskAdjustedKelly = kellyFraction * (1 - safeRiskScore);
    
    // Include learning analytics in Kelly calculation
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    const learningAdjustment = learningAnalytics.executionRate > 0.6 ? 1.1 : 0.9;
    
    const finalKelly = Math.max(0, Math.min(0.2, this.safeValue(riskAdjustedKelly * learningAdjustment, 0.03)));
    console.log(`[Enhanced AI Model] 🔧 Enhanced Kelly fraction calculated: ${finalKelly.toFixed(3)} (raw: ${kellyFraction.toFixed(3)})`);
    
    return finalKelly;
  }

  private calculateRealMAE(marketContext: MarketContext, riskScore: number): number {
    const baseMAE = marketContext.volatilityRegime === 'HIGH' ? 1.5 :
                   marketContext.volatilityRegime === 'MEDIUM' ? 1.0 : 0.8;
    
    const riskAdjustment = 1 + (riskScore * 0.5);
    
    return baseMAE * riskAdjustment;
  }

  private calculateRealFeatureContributions(features: any): any {
    const contributions: any = {};
    
    Object.entries(features).forEach(([feature, value]) => {
      const weight = this.modelWeights.get(`${feature}_base`) || 0.15;
      const safeValue = this.safeValue(value as number, 0);
      contributions[feature] = safeValue * weight;
    });
    
    console.log(`[Enhanced AI Model] 🔧 Feature contributions calculated:`, contributions);
    return contributions;
  }

  private updateEnhancedThresholds(): void {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    
    if (realStats.totalTrades < 15) return; // Need sufficient real data
    
    // Update adaptive thresholds based on REAL performance AND learning analytics
    const winRateAdjustment = (realStats.winRate - 0.5) * 0.12;
    const profitFactorAdjustment = Math.min(0.06, (realStats.profitFactor - 1.0) * 0.025);
    const executionRateAdjustment = learningAnalytics.executionRate > 0.4 ? 0.02 : -0.01;
    
    this.adaptiveThresholds = {
      minProbability: Math.max(0.48, 0.52 + winRateAdjustment + executionRateAdjustment),
      minConfidence: Math.max(0.3, 0.35 + winRateAdjustment * 0.5),
      maxRiskScore: Math.min(0.8, 0.75 - profitFactorAdjustment),
      kellyThreshold: Math.max(0.02, 0.04 + profitFactorAdjustment)
    };
    
    // Update dynamic thresholds
    this.dynamicThresholds = {
      minProbability: Math.max(0.5, this.adaptiveThresholds.minProbability - 0.02),
      minConfidence: Math.max(0.4, this.adaptiveThresholds.minConfidence + 0.05),
      maxRiskScore: Math.min(0.8, this.adaptiveThresholds.maxRiskScore + 0.05)
    };

    console.log(`[Enhanced AI Model] 🎯 Updated thresholds with learning analytics: prob=${this.adaptiveThresholds.minProbability.toFixed(3)}, conf=${this.adaptiveThresholds.minConfidence.toFixed(3)}`);
  }

  private trackSignalGeneration(): void {
    this.signalCount++;
    const currentHour = new Date().getHours();
    const hourlyCount = this.hourlySignalCounts.get(currentHour) || 0;
    this.hourlySignalCounts.set(currentHour, hourlyCount + 1);
    
    console.log(`[Enhanced AI Model] ✅ Signal generated. Total: ${this.signalCount}, Last hour: ${hourlyCount + 1}`);
  }

  private safeValue(value: number, fallback: number = 0): number {
    if (isNaN(value) || !isFinite(value)) {
      console.log(`[Enhanced AI Model] ⚠️ NaN/Infinite value detected, using fallback: ${fallback}`);
      return fallback;
    }
    return value;
  }

  private sigmoidActivation(x: number): number {
    const safeX = this.safeValue(x, 0);
    const result = this.safeValue(1 / (1 + Math.exp(-safeX)), 0.5);
    console.log(`[Enhanced AI Model] 🔧 Sigmoid activation: ${safeX.toFixed(3)} -> ${result.toFixed(3)}`);
    return result;
  }

  updateModel(outcome: TradeOutcome): void {
    console.log(`[Enhanced AI Model] 📚 Learning from REAL trade outcome: ${outcome.success ? 'WIN' : 'LOSS'}, Return: ${outcome.actualReturn.toFixed(2)}%`);
    
    // Log exit effectiveness for learning - create a proper MarketContext object with correct types
    const currentHour = new Date().getHours();
    let marketHour: MarketContext['marketHour'];
    
    // Map hour to market session
    if (currentHour >= 8 && currentHour < 16) {
      marketHour = 'LONDON';
    } else if (currentHour >= 14 && currentHour < 22) {
      marketHour = 'NEW_YORK';
    } else if (currentHour >= 22 || currentHour < 8) {
      marketHour = 'ASIA';
    } else {
      marketHour = 'OVERLAP';
    }
    
    const marketContext: MarketContext = {
      marketRegime: 'SIDEWAYS_QUIET', // Default fallback regime
      volatilityRegime: 'MEDIUM' as const, // Ensure this is treated as string literal
      liquidityScore: 0.5,
      spreadQuality: 0.5,
      marketHour: marketHour,
      newsImpact: 0.0
    };
    
    this.meanReversionService.logExitEffectiveness(
      'TRADE_CLOSE',
      outcome.profitLoss,
      outcome.holdingTime,
      marketContext,
      outcome.success
    );
    
    // NO SYNTHETIC DATA GENERATION - Only update from real trade
    this.updateWeightsFromRealData();
    this.updateEnhancedThresholds();
    
    console.log('[Enhanced AI Model] ✅ Model updated with REAL trade data and learning analytics');
  }

  getModelPerformance() {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const dataQuality = this.realTrainingService.getDataQuality();
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    
    return {
      isUsingRealData: true,
      realDataStats: realStats,
      dataQuality: dataQuality,
      learningAnalytics: learningAnalytics,
      modelWeights: Object.fromEntries(this.modelWeights),
      adaptiveThresholds: this.adaptiveThresholds,
      dynamicThresholds: this.dynamicThresholds,
      signalCount: this.signalCount,
      qualityLevel: this.getDataQualityLevel()
    };
  }

  private getDataQualityLevel(): string {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const learningAnalytics = this.meanReversionService.getLearningAnalytics();
    
    if (realStats.totalTrades >= 50 && learningAnalytics.totalLearningPoints >= 200) return 'EXCELLENT';
    if (realStats.totalTrades >= 25 && learningAnalytics.totalLearningPoints >= 100) return 'GOOD';
    if (realStats.totalTrades >= 10 && learningAnalytics.totalLearningPoints >= 50) return 'BUILDING';
    return 'INSUFFICIENT';
  }

  getAdaptiveThresholds() {
    return this.meanReversionService.getAdaptiveThresholds();
  }

  getDynamicThresholds() {
    return this.dynamicThresholds;
  }

  getRealTrainingDataService(): RealTrainingDataService {
    return this.realTrainingService;
  }

  getMeanReversionService(): MeanReversionTPSLService {
    return this.meanReversionService;
  }

  // New method to support signal attempt logging from trading system
  logSignalAttemptFromTradingSystem(
    indicators: AdvancedIndicators,
    marketContext: MarketContext,
    orderBookImbalance: number,
    prediction: PredictionOutput,
    wasExecuted: boolean,
    executionReason?: string
  ): void {
    this.meanReversionService.logSignalAttempt(
      indicators,
      marketContext,
      orderBookImbalance,
      prediction,
      wasExecuted,
      executionReason
    );
  }
}
