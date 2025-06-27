import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';
import { RealTrainingDataService } from './realTrainingDataService';

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
  private modelWeights: Map<string, number>;
  private adaptiveThresholds: any;
  private dynamicThresholds: any;
  private signalCount: number = 0;
  private hourlySignalCounts: Map<number, number> = new Map();

  constructor() {
    this.realTrainingService = new RealTrainingDataService();
    this.modelWeights = new Map();
    
    // Initialize with minimal conservative weights - NO FALLBACK VALUES
    this.initializeMinimalWeights();
    
    console.log('[Real AI Model] 🚀 Initializing with REAL training data ONLY:');
    const realStats = this.realTrainingService.getRealMarketStatistics();
    console.log(`  - Real trades: ${realStats.totalTrades}`);
    console.log(`  - Real win rate: ${(realStats.winRate * 100).toFixed(1)}%`);
    console.log(`  - Real profit factor: ${realStats.profitFactor.toFixed(2)}`);
    console.log(`  - Prediction accuracy: ${(this.realTrainingService.getDataQuality().predictionAccuracy * 100).toFixed(1)}%`);
    console.log(`  - Data quality: ${this.getDataQualityLevel()}`);
    
    // Only use real data - no synthetic generation
    if (realStats.totalTrades > 0) {
      this.updateWeightsFromRealData();
      console.log('[Real AI Model] ✅ Using REAL trade data for model weights');
    } else {
      console.log('[Real AI Model] ⚠️ No real trade data yet - using minimal conservative weights');
    }
  }

  private initializeMinimalWeights(): void {
    // Minimal conservative weights - will be updated with real data only
    this.modelWeights.set('technical_base', 0.15);
    this.modelWeights.set('momentum_base', 0.15);
    this.modelWeights.set('volatility_base', 0.20);
    this.modelWeights.set('market_structure_base', 0.25);
    this.modelWeights.set('orderbook_depth_base', 0.25);
    
    // Conservative thresholds until real data builds up
    this.adaptiveThresholds = {
      minProbability: 0.52,
      minConfidence: 0.35,
      maxRiskScore: 0.75,
      kellyThreshold: 0.05
    };
    
    this.dynamicThresholds = {
      minProbability: 0.50,
      minConfidence: 0.40,
      maxRiskScore: 0.80
    };
  }

  private updateWeightsFromRealData(): void {
    const realData = this.realTrainingService.getRealTrainingData();
    if (realData.length === 0) return;

    console.log(`[Real AI Model] 📊 Updating weights from ${realData.length} REAL trades`);

    // Calculate feature performance from REAL trades only
    const featurePerformance = this.calculateRealFeaturePerformance(realData);
    
    // Update weights based on actual performance
    Object.entries(featurePerformance).forEach(([feature, performance]) => {
      const currentWeight = this.modelWeights.get(`${feature}_base`) || 0.2;
      const performanceValue = typeof performance === 'number' ? performance : 0;
      const adjustedWeight = currentWeight * (0.8 + performanceValue * 0.4); // Adjust based on real performance
      this.modelWeights.set(`${feature}_base`, Math.max(0.05, Math.min(0.4, adjustedWeight)));
    });

    console.log('[Real AI Model] ✅ Model weights updated from REAL trade performance');
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
      const predictionAccuracy = trade.success ? 1 : -1;
      
      if (trade.prediction.featureContributions) {
        Object.keys(featurePerformance).forEach(feature => {
          const contribution = trade.prediction.featureContributions![feature] || 0;
          featurePerformance[feature] += contribution * predictionAccuracy;
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
    console.log(`[AI Model] 🚀 Starting prediction with enhanced NaN protection`);
    
    // Extract features from REAL market data only
    const features = this.extractRealFeatures(input);
    
    console.log(`[AI Model] 🎯 Features extracted using REAL market data`);
    
    // Apply market regime adjustments based on REAL market context
    const regimeMultipliers = this.getRealMarketRegimeMultipliers(input.marketContext);
    const adjustedFeatures = this.applyRealRegimeMultipliers(features, regimeMultipliers);
    
    console.log(`[AI Model] 🚀 Applying enhanced ${input.marketContext.marketRegime} + ${input.marketContext.volatilityRegime} volatility multipliers`);
    
    // Calculate prediction using REAL data weights
    const rawScore = this.calculateRealPredictionScore(adjustedFeatures);
    
    // Apply performance bias from REAL trades
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const performanceBias = realStats.totalTrades > 10 ? 
      this.safeValue((realStats.winRate - 0.5) * 0.1, 0) : 0;
    
    console.log(`[AI Model] 📊 Enhanced raw score: ${rawScore.toFixed(3)}, Performance bias: ${performanceBias.toFixed(3)}`);
    
    const adjustedScore = this.safeValue(rawScore + performanceBias, 0);
    const probability = this.sigmoidActivation(adjustedScore);
    
    // Calculate other metrics using REAL data
    const confidence = this.calculateRealConfidence(features, input.marketContext);
    const expectedReturn = this.calculateRealExpectedReturn(probability, input.marketContext);
    const riskScore = this.calculateRealRiskScore(features, input.marketContext);
    const timeHorizon = this.calculateRealTimeHorizon(input.marketContext);
    const kellyFraction = this.calculateRealKellyFraction(probability, expectedReturn, riskScore);
    const maxAdverseExcursion = this.calculateRealMAE(input.marketContext, riskScore);
    
    console.log(`[AI Model] 🚀 Enhanced Kelly - Raw: ${kellyFraction.toFixed(3)}, Adjusted: ${Math.min(kellyFraction, 0.3).toFixed(3)}, Win Prob: ${probability.toFixed(3)}`);
    
    // Update adaptive and dynamic thresholds based on REAL performance
    this.updateRealThresholds();
    
    // Track signal generation for real data quality
    this.trackSignalGeneration();
    
    const prediction: PredictionOutput = {
      probability,
      confidence,
      expectedReturn,
      riskScore,
      timeHorizon,
      kellyFraction: Math.min(kellyFraction, 0.3), // Cap at 30% for safety
      maxAdverseExcursion,
      features: adjustedFeatures,
      featureContributions: this.calculateRealFeatureContributions(adjustedFeatures)
    };
    
    console.log(`[AI Model] 🚀 Enhanced prediction - Prob: ${probability.toFixed(3)}, Raw Score: ${rawScore.toFixed(3)}, Kelly: ${kellyFraction.toFixed(3)}`);
    console.log(`[AI Model] 📊 Feature contributions - Tech: ${prediction.featureContributions!.technical.toFixed(3)}, Momentum: ${prediction.featureContributions!.momentum.toFixed(3)}, Market: ${prediction.featureContributions!.market_structure.toFixed(3)}`);
    
    return prediction;
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
    
    console.log(`[AI Model] 🔧 Features calculated: tech=${technical.toFixed(3)}, momentum=${momentum.toFixed(3)}, volatility=${volatility.toFixed(3)}, market=${market_structure.toFixed(3)}, orderbook=${orderbook_depth.toFixed(3)}`);
    
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
        console.log(`[Real AI Model] 🚀 Enhanced counter-trend boost for ${marketContext.marketRegime} + ${marketContext.volatilityRegime} volatility`);
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
      const weight = this.modelWeights.get(`${feature}_base`) || 0.2;
      const safeFeatureValue = this.safeValue(value as number, 0);
      score += safeFeatureValue * weight;
    });
    
    const finalScore = this.safeValue(score, 0);
    console.log(`[AI Model] 🔧 Prediction score calculated: ${finalScore.toFixed(3)}`);
    return finalScore;
  }

  private calculateRealConfidence(features: any, marketContext: MarketContext): number {
    // Fix TypeScript error by ensuring we work with numbers
    const featureValues = Object.values(features) as number[];
    const safeFeatureValues = featureValues.map(val => this.safeValue(val, 0));
    const featureStrength = safeFeatureValues.reduce((sum: number, val: number) => 
      sum + Math.abs(val), 0) / safeFeatureValues.length;
    
    const liquidityBonus = Math.max(0, marketContext.liquidityScore - 0.5) * 0.2;
    const spreadBonus = Math.max(0, marketContext.spreadQuality - 0.5) * 0.15;
    
    const baseConfidence = this.safeValue(Math.tanh(featureStrength * 2) * 0.7, 0.3);
    const finalConfidence = Math.min(0.95, baseConfidence + liquidityBonus + spreadBonus + 0.25);
    
    console.log(`[AI Model] 🔧 Confidence calculated: ${finalConfidence.toFixed(3)} (base: ${baseConfidence.toFixed(3)})`);
    return finalConfidence;
  }

  private calculateRealExpectedReturn(probability: number, marketContext: MarketContext): number {
    const safeProbability = this.safeValue(probability, 0.5);
    const baseReturn = (safeProbability - 0.5) * 4.0;
    
    const volatilityAdjustment = marketContext.volatilityRegime === 'HIGH' ? 1.3 :
                                marketContext.volatilityRegime === 'MEDIUM' ? 1.0 : 0.8;
    
    const liquidityAdjustment = 0.8 + (marketContext.liquidityScore * 0.4);
    
    const finalReturn = this.safeValue(baseReturn * volatilityAdjustment * liquidityAdjustment, 0.5);
    console.log(`[AI Model] 🔧 Expected return calculated: ${finalReturn.toFixed(3)}%`);
    return finalReturn;
  }

  private calculateRealRiskScore(features: any, marketContext: MarketContext): number {
    // Fix TypeScript error by ensuring we work with numbers
    const featureValues = Object.values(features) as number[];
    const safeFeatureValues = featureValues.map(val => this.safeValue(val, 0));
    const featureUncertainty = safeFeatureValues.reduce((sum: number, val: number) => 
      sum + Math.abs(0.5 - Math.abs(val)), 0) / safeFeatureValues.length;
    
    const volatilityRisk = marketContext.volatilityRegime === 'HIGH' ? 0.3 : 
                          marketContext.volatilityRegime === 'MEDIUM' ? 0.15 : 0.05;
    
    const liquidityRisk = Math.max(0, 0.5 - marketContext.liquidityScore) * 0.4;
    
    const finalRisk = Math.min(0.95, this.safeValue(featureUncertainty + volatilityRisk + liquidityRisk, 0.5));
    console.log(`[AI Model] 🔧 Risk score calculated: ${finalRisk.toFixed(3)}`);
    return finalRisk;
  }

  private calculateRealTimeHorizon(marketContext: MarketContext): number {
    const baseHorizon = marketContext.volatilityRegime === 'HIGH' ? 60 :
                       marketContext.volatilityRegime === 'MEDIUM' ? 90 : 120;
    
    const liquidityAdjustment = 0.8 + (marketContext.liquidityScore * 0.4);
    
    return Math.round(baseHorizon * liquidityAdjustment);
  }

  private calculateRealKellyFraction(probability: number, expectedReturn: number, riskScore: number): number {
    const safeProbability = this.safeValue(probability, 0.5);
    const safeExpectedReturn = this.safeValue(expectedReturn, 0);
    const safeRiskScore = this.safeValue(riskScore, 0.5);
    
    if (safeExpectedReturn <= 0) {
      console.log(`[AI Model] 🔧 Kelly: Expected return <= 0, returning 0`);
      return 0;
    }
    
    const winProbability = safeProbability;
    const lossProbability = 1 - safeProbability;
    const avgWin = Math.abs(safeExpectedReturn);
    const avgLoss = avgWin * 0.8; // Conservative loss estimate
    
    if (avgLoss === 0) {
      console.log(`[AI Model] 🔧 Kelly: Average loss = 0, returning 0`);
      return 0;
    }
    
    const kellyFraction = (winProbability * avgWin - lossProbability * avgLoss) / avgWin;
    const riskAdjustedKelly = kellyFraction * (1 - safeRiskScore);
    
    const finalKelly = Math.max(0, Math.min(0.25, this.safeValue(riskAdjustedKelly, 0.05)));
    console.log(`[AI Model] 🔧 Kelly fraction calculated: ${finalKelly.toFixed(3)} (raw: ${kellyFraction.toFixed(3)})`);
    
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
      const weight = this.modelWeights.get(`${feature}_base`) || 0.2;
      const safeValue = this.safeValue(value as number, 0);
      contributions[feature] = safeValue * weight;
    });
    
    console.log(`[AI Model] 🔧 Feature contributions calculated:`, contributions);
    return contributions;
  }

  private updateRealThresholds(): void {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    
    if (realStats.totalTrades < 10) return; // Need sufficient real data
    
    // Update adaptive thresholds based on REAL performance
    const winRateAdjustment = (realStats.winRate - 0.5) * 0.1;
    const profitFactorAdjustment = Math.min(0.05, (realStats.profitFactor - 1.0) * 0.02);
    
    this.adaptiveThresholds = {
      minProbability: Math.max(0.45, 0.5 + winRateAdjustment),
      minConfidence: Math.max(0.25, 0.3 + winRateAdjustment * 0.5),
      maxRiskScore: Math.min(0.85, 0.8 - profitFactorAdjustment),
      kellyThreshold: Math.max(0.02, 0.05 + profitFactorAdjustment)
    };
    
    // Update dynamic thresholds
    this.dynamicThresholds = {
      minProbability: Math.max(0.48, this.adaptiveThresholds.minProbability - 0.02),
      minConfidence: Math.max(0.35, this.adaptiveThresholds.minConfidence + 0.05),
      maxRiskScore: Math.min(0.85, this.adaptiveThresholds.maxRiskScore + 0.05)
    };
  }

  private trackSignalGeneration(): void {
    this.signalCount++;
    const currentHour = new Date().getHours();
    const hourlyCount = this.hourlySignalCounts.get(currentHour) || 0;
    this.hourlySignalCounts.set(currentHour, hourlyCount + 1);
    
    console.log(`[Real AI Model] ✅ Signal generated. Total: ${this.signalCount}, Last hour: ${hourlyCount + 1}`);
  }

  private safeValue(value: number, fallback: number = 0): number {
    if (isNaN(value) || !isFinite(value)) {
      console.log(`[AI Model] ⚠️ NaN/Infinite value detected, using fallback: ${fallback}`);
      return fallback;
    }
    return value;
  }

  private sigmoidActivation(x: number): number {
    const safeX = this.safeValue(x, 0);
    const result = this.safeValue(1 / (1 + Math.exp(-safeX)), 0.5);
    console.log(`[AI Model] 🔧 Sigmoid activation: ${safeX.toFixed(3)} -> ${result.toFixed(3)}`);
    return result;
  }

  updateModel(outcome: TradeOutcome): void {
    console.log(`[Real AI Model] 📚 Learning from REAL trade outcome: ${outcome.success ? 'WIN' : 'LOSS'}, Return: ${outcome.actualReturn.toFixed(2)}%`);
    
    // NO SYNTHETIC DATA GENERATION - Only update from real trade
    this.updateWeightsFromRealData();
    this.updateRealThresholds();
    
    console.log('[Real AI Model] ✅ Model updated with REAL trade data only');
  }

  getModelPerformance() {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    const dataQuality = this.realTrainingService.getDataQuality();
    
    return {
      isUsingRealData: true,
      realDataStats: realStats,
      dataQuality: dataQuality,
      modelWeights: Object.fromEntries(this.modelWeights),
      adaptiveThresholds: this.adaptiveThresholds,
      dynamicThresholds: this.dynamicThresholds,
      signalCount: this.signalCount,
      qualityLevel: this.getDataQualityLevel()
    };
  }

  private getDataQualityLevel(): string {
    const realStats = this.realTrainingService.getRealMarketStatistics();
    
    if (realStats.totalTrades >= 50) return 'EXCELLENT';
    if (realStats.totalTrades >= 20) return 'GOOD';
    if (realStats.totalTrades >= 10) return 'BUILDING';
    return 'INSUFFICIENT';
  }

  getAdaptiveThresholds() {
    return this.adaptiveThresholds;
  }

  getDynamicThresholds() {
    return this.dynamicThresholds;
  }

  getRealTrainingDataService(): RealTrainingDataService {
    return this.realTrainingService;
  }
}
