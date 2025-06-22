import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position, Portfolio, TradingConfig as BaseTradingConfig } from '@/types/trading';
import { PortfolioCalculator } from '@/services/portfolioCalculator';

const initialPortfolio: Portfolio = {
  baseCapital: 10000,
  availableBalance: 10000,
  lockedProfits: 0,
  positions: [],
  totalPnL: 0,
  dayPnL: 0,
  equity: 10000
};

interface BasicTechnicalIndicators {
  rsi: number;
  ema_fast: number;
  ema_slow: number;
  macd: number;
  signal: number;
  volume_ratio: number;
}

interface AdvancedTradingConfig extends BaseTradingConfig {
  minProbability: number;
  minConfidence: number;
  maxRiskScore: number;
  adaptiveSizing: boolean;
  learningEnabled: boolean;
  maxPositionsPerSymbol: number;
  useAdaptiveThresholds: boolean;
  enableProfitLock: boolean;
  profitLockPercentage: number;
  minProfitLockThreshold?: number;
  useKellyCriterion: boolean;
  maxKellyFraction: number;
  enableTrailingStop: boolean;
  trailingStopATRMultiplier: number;
  enablePartialProfits: boolean;
  partialProfitLevels: number[];
  debugMode: boolean;
  minLiquidityScore: number;
  minSpreadQuality: number;
  useDynamicThresholds: boolean;
  enableOpportunityDetection: boolean;
}

interface PositionTracking {
  position: Position;
  prediction: PredictionOutput;
  entryTime: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  trailingStopPrice?: number;
  partialProfitsTaken: number;
}

export const useAdvancedTradingSystem = (
  symbol: string,
  bids: any[],
  asks: any[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);

  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.48, // Recalibrated from 0.50
    minConfidence: 0.30,  // Recalibrated from 0.40
    maxRiskScore: 0.80,   // Recalibrated from 0.75
    adaptiveSizing: true,
    learningEnabled: true,
    useAdaptiveThresholds: true,
    useDynamicThresholds: true, // New feature
    enableOpportunityDetection: true, // New feature
    maxPositionsPerSymbol: 100,
    maxPositionSize: 1500,
    maxDailyLoss: 600,
    stopLossPercentage: 1.2,
    takeProfitPercentage: 2.5,
    maxOpenPositions: 100,
    riskPerTrade: 100,
    enableProfitLock: true,
    profitLockPercentage: 1.0,
    minProfitLockThreshold: 0,
    useKellyCriterion: true,
    maxKellyFraction: 0.20, // Increased from 0.15
    enableTrailingStop: true,
    trailingStopATRMultiplier: 2.0,
    enablePartialProfits: true,
    partialProfitLevels: [0.8, 1.5, 2.2],
    debugMode: true,
    minLiquidityScore: 0.02, // Further reduced from 0.05
    minSpreadQuality: 0.05   // Further reduced from 0.1
  });

  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, PositionTracking>>(new Map());

  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [basicIndicators, setBasicIndicators] = useState<BasicTechnicalIndicators | null>(null);

  const technicalAnalysis = useRef(new AdvancedTechnicalAnalysis());
  const aiModel = useRef(new AIPredictionModel());
  const lastSignalTime = useRef(0);

  const canOpenPosition = useCallback((positionValue: number): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN').length;
    
    const hasEnoughBalance = portfolio.availableBalance >= positionValue;
    const isUnderMaxPositions = openPositions < config.maxOpenPositions;
    const isUnderMaxSize = positionValue <= config.maxPositionSize;
    const isUnderMaxLoss = Math.abs(portfolio.dayPnL) < config.maxDailyLoss;

    if (config.debugMode) {
      console.log(`[Trading Bot] 💰 Position validation:`);
      console.log(`  - Available Balance: ${portfolio.availableBalance.toFixed(2)} >= ${positionValue.toFixed(2)} ✓${hasEnoughBalance ? '✅' : '❌'}`);
      console.log(`  - Open Positions: ${openPositions} < ${config.maxOpenPositions} ✓${isUnderMaxPositions ? '✅' : '❌'}`);
      console.log(`  - Position Size: ${positionValue.toFixed(2)} <= ${config.maxPositionSize} ✓${isUnderMaxSize ? '✅' : '❌'}`);
      console.log(`  - Daily Loss: ${Math.abs(portfolio.dayPnL).toFixed(2)} < ${config.maxDailyLoss} ✓${isUnderMaxLoss ? '✅' : '❌'}`);
    }

    return hasEnoughBalance && isUnderMaxPositions && isUnderMaxSize && isUnderMaxLoss;
  }, [portfolio, config]);

  const addPosition = useCallback((position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>): Position | null => {
    const positionValue = position.size * position.entryPrice;
    if (!canOpenPosition(positionValue)) {
        console.log(`[Trading Bot] ❌ Cannot open position: Risk limits exceeded`);
        return null;
    }

    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      unrealizedPnL: 0,
      realizedPnL: 0,
      status: 'OPEN'
    };

    console.log(`[Portfolio Debug] 📍 Adding position: ${newPosition.side} ${newPosition.size.toFixed(6)} ${newPosition.symbol} at ${newPosition.entryPrice.toFixed(2)}`);

    setPortfolio(prev => {
        const updatedPositions = [...prev.positions, newPosition];
        const updatedPortfolio = {
            ...prev,
            positions: updatedPositions
        };
        
        // Recalculate everything with precise math
        return PortfolioCalculator.recalculatePortfolio(updatedPortfolio);
    });

    console.log(`[Trading Bot] ✅ Position opened: ${newPosition.side} ${newPosition.size.toFixed(6)} ${newPosition.symbol} at ${newPosition.entryPrice.toFixed(2)}`);
    return newPosition;
  }, [canOpenPosition]);

  const closePosition = useCallback((positionId: string, closePrice: number) => {
    console.log(`[Portfolio Debug] 🚪 Closing position ${positionId} at price ${closePrice.toFixed(2)}`);
    
    setPortfolio(prev => {
      const position = prev.positions.find(p => p.id === positionId);
      if (!position || position.status === 'CLOSED') {
        console.warn(`[Portfolio Debug] ⚠️ Position ${positionId} not found or already closed`);
        return prev;
      }

      const realizedPnL = position.side === 'BUY'
        ? (closePrice - position.entryPrice) * position.size
        : (position.entryPrice - closePrice) * position.size;

      console.log(`[Portfolio Debug] 💵 Calculated realized P&L: ${realizedPnL.toFixed(6)}`);

      let newLockedProfits = prev.lockedProfits;

      if (config.enableProfitLock && realizedPnL > 0) {
        const isAboveThreshold = config.minProfitLockThreshold === undefined || realizedPnL >= config.minProfitLockThreshold;
        if (isAboveThreshold) {
          const lockedAmount = realizedPnL * config.profitLockPercentage;
          newLockedProfits += lockedAmount;
          console.log(`[Profit Lock] 🔒 Locking ${lockedAmount.toFixed(2)} USD profit (${(config.profitLockPercentage * 100).toFixed(1)}% of ${realizedPnL.toFixed(2)})`);
        }
      }

      const updatedPositions = prev.positions.map(p =>
        p.id === positionId
          ? { ...p, status: 'CLOSED' as const, realizedPnL, currentPrice: closePrice, unrealizedPnL: 0 }
          : p
      );

      const updatedPortfolio = {
        ...prev,
        positions: updatedPositions,
        lockedProfits: newLockedProfits,
        dayPnL: prev.dayPnL + realizedPnL,
      };

      console.log(`[Trading Bot] 🚪 Position closed: ${position.symbol} P&L: ${realizedPnL.toFixed(2)} USD`);

      // Recalculate everything with precise math
      return PortfolioCalculator.recalculatePortfolio(updatedPortfolio);
    });
  }, [config.enableProfitLock, config.profitLockPercentage, config.minProfitLockThreshold]);

  const updatePositionPrices = useCallback((currentPrice: number) => {
    setPortfolio(prev => {
        const hasOpenPositions = prev.positions.some(p => p.symbol === symbol && p.status === 'OPEN');
        if (!hasOpenPositions) return prev;

        const updatedPositions = prev.positions.map(position => {
            if (position.symbol === symbol && position.status === 'OPEN') {
                return { ...position, currentPrice };
            }
            return position;
        });

        const updatedPortfolio = {
            ...prev,
            positions: updatedPositions
        };

        // Recalculate with precise math
        const recalculated = PortfolioCalculator.recalculatePortfolio(updatedPortfolio);

        if (config.debugMode && Math.abs(recalculated.equity - prev.equity) > 0.01) {
          console.log(`[Portfolio Debug] 🔄 Price update: Equity ${prev.equity.toFixed(6)} → ${recalculated.equity.toFixed(6)}`);
        }

        return recalculated;
    });
  }, [symbol, config.debugMode]);

  const updatePositionTracking = useCallback((currentPrice: number) => {
    setActivePositions(prev => {
      const updated = new Map(prev);
      
      prev.forEach((tracking, positionId) => {
        const { position } = tracking;
        const priceChange = position.side === 'BUY' 
          ? (currentPrice - position.entryPrice) / position.entryPrice
          : (position.entryPrice - currentPrice) / position.entryPrice;

        const newMFE = Math.max(tracking.maxFavorableExcursion, Math.max(0, priceChange));
        const newMAE = Math.min(tracking.maxAdverseExcursion, Math.min(0, priceChange));

        let newTrailingStopPrice = tracking.trailingStopPrice;
        if (config.enableTrailingStop && indicators?.atr) {
          const atrDistance = indicators.atr * config.trailingStopATRMultiplier;
          
          if (position.side === 'BUY') {
            const potentialStop = currentPrice - atrDistance;
            newTrailingStopPrice = Math.max(newTrailingStopPrice || 0, potentialStop);
          } else {
            const potentialStop = currentPrice + atrDistance;
            newTrailingStopPrice = Math.min(newTrailingStopPrice || Infinity, potentialStop);
          }
        }

        updated.set(positionId, {
          ...tracking,
          maxFavorableExcursion: newMFE,
          maxAdverseExcursion: newMAE,
          trailingStopPrice: newTrailingStopPrice
        });
      });

      return updated;
    });
  }, [config.enableTrailingStop, config.trailingStopATRMultiplier, indicators]);

  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      updatePositionPrices(currentPrice);
      updatePositionTracking(currentPrice);
    }
  }, [bids, asks, updatePositionPrices, updatePositionTracking]);

  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      const volume = bids[0].quantity + asks[0].quantity;
      
      console.log(`[Trading Bot] 🔄 Recalibrated price update: ${midPrice.toFixed(2)}, Volume: ${volume.toFixed(4)}`);
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      console.log(`[Trading Bot] 🎯 Enhanced market analysis - Regime: ${newMarketContext?.marketRegime}, Volatility: ${newMarketContext?.volatilityRegime}, Liquidity: ${newMarketContext?.liquidityScore?.toFixed(3)}`);
      
      setIndicators(newIndicators);
      setMarketContext(newMarketContext);

      const priceHistory = technicalAnalysis.current.getPriceHistory();
      if (priceHistory.length >= 20 && newIndicators) {
        const sma_fast = priceHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const sma_slow = priceHistory.slice(-20).reduce((a, b) => a + b, 0) / 20;
        setBasicIndicators({
          rsi: newIndicators.rsi_14,
          ema_fast: sma_fast,
          ema_slow: sma_slow,
          macd: newIndicators.macd,
          signal: newIndicators.macd_signal,
          volume_ratio: newIndicators.volume_ratio,
        });
      }
      
      if (newIndicators && newMarketContext) {
        console.log(`[Trading Bot] 🎯 Recalibrated signal generation with enhanced AI model`);
        generateRecalibratedSignal(midPrice, newIndicators, newMarketContext);
      } else {
        console.log(`[Trading Bot] Awaiting sufficient data - History: ${technicalAnalysis.current.getPriceHistoryLength()}/20`);
      }
    }
  }, [bids, asks]);

  useEffect(() => {
    if (activePositions.size > 0 && bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      checkEnhancedExitConditions(currentPrice);
    }
  }, [bids, asks, activePositions]);

  const calculateKellySizedPosition = useCallback((
    basePositionSizeUSD: number,
    prediction: PredictionOutput,
    currentPrice: number
  ): number => {
    if (!config.useKellyCriterion) {
      return basePositionSizeUSD / currentPrice;
    }

    const kellyFraction = Math.min(prediction.kellyFraction, config.maxKellyFraction);
    const kellyPositionSize = portfolio.availableBalance * kellyFraction;
    
    console.log(`[Kelly Sizing] 🎯 Optimized Kelly fraction: ${kellyFraction.toFixed(3)}, Position size: ${kellyPositionSize.toFixed(2)} USD`);
    
    return Math.min(kellyPositionSize, config.maxPositionSize) / currentPrice;
  }, [config.useKellyCriterion, config.maxKellyFraction, config.maxPositionSize, portfolio.availableBalance]);

  const getDynamicConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null,
    adaptiveThresholds?: any,
    dynamicThresholds?: any
  ): AdvancedTradingConfig => {
    if (!marketContext) return baseConfig;

    let thresholds = baseConfig;
    
    // Use dynamic thresholds from AI model if enabled
    if (baseConfig.useDynamicThresholds && dynamicThresholds) {
      thresholds = {
        ...baseConfig,
        minProbability: dynamicThresholds.minProbability,
        minConfidence: dynamicThresholds.minConfidence,
        maxRiskScore: dynamicThresholds.maxRiskScore
      };
      console.log(`[Dynamic Config] 🔄 Using AI dynamic thresholds - Prob: ${dynamicThresholds.minProbability.toFixed(3)}, Conf: ${dynamicThresholds.minConfidence.toFixed(3)}`);
    } else if (baseConfig.useAdaptiveThresholds && adaptiveThresholds) {
      thresholds = {
        ...baseConfig,
        minProbability: adaptiveThresholds.minProbability,
        minConfidence: adaptiveThresholds.minConfidence,
        maxRiskScore: adaptiveThresholds.maxRiskScore
      };
    }

    let probabilityAdjustment = 0;
    let confidenceAdjustment = 0;
    let riskAdjustment = 0;

    // Recalibrated regime-based adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            probabilityAdjustment = -0.015; // Reduced from -0.025
            confidenceAdjustment = -0.02;  // Reduced from -0.04
            riskAdjustment = 0.04;         // Reduced from 0.06
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            probabilityAdjustment = -0.008; // Reduced from -0.015
            confidenceAdjustment = -0.01;  // Reduced from -0.02
            break;
        case 'SIDEWAYS_VOLATILE':
            probabilityAdjustment = 0.025;  // Reduced from 0.04
            confidenceAdjustment = 0.04;   // Reduced from 0.06
            riskAdjustment = -0.08;        // Reduced from -0.12
            break;
        case 'SIDEWAYS_QUIET':
            probabilityAdjustment = 0.015;  // Reduced from 0.025
            confidenceAdjustment = 0.025;  // Reduced from 0.04
            riskAdjustment = -0.04;        // Reduced from -0.06
            break;
    }

    // Enhanced liquidity-based adjustments
    const liquidityAdjustment = (marketContext.liquidityScore - 0.5) * 0.025; // Reduced from 0.03
    probabilityAdjustment += liquidityAdjustment;
    
    return {
        ...thresholds,
        minProbability: Math.max(0.45, thresholds.minProbability + probabilityAdjustment),
        minConfidence: Math.max(0.25, thresholds.minConfidence + confidenceAdjustment),
        maxRiskScore: Math.min(0.85, thresholds.maxRiskScore + riskAdjustment)
    };
  }, []);

  const executeAdvancedSignal = useCallback((
    signal: TradingSignal,
    prediction: PredictionOutput
  ) => {
    if (signal.action === 'HOLD') {
      console.warn(`[Trading Bot] ⚠️ Attempted to execute a 'HOLD' signal.`);
      return;
    }

    console.log(`[Trading Bot] 🚀 Executing recalibrated signal: ${signal.action} ${signal.symbol}`);
    console.log(`[Trading Bot] 📊 Enhanced metrics - Kelly: ${prediction.kellyFraction.toFixed(3)}, Features: ${JSON.stringify(prediction.featureContributions)}`);
    
    const newPosition = addPosition({
      symbol: signal.symbol,
      side: signal.action,
      size: signal.quantity,
      entryPrice: signal.price,
      currentPrice: signal.price,
      timestamp: signal.timestamp
    });

    if (newPosition) {
      setActivePositions(prev => new Map(prev.set(newPosition.id, {
        position: newPosition,
        prediction,
        entryTime: Date.now(),
        maxFavorableExcursion: 0,
        maxAdverseExcursion: 0,
        partialProfitsTaken: 0
      })));

      console.log(`[Trading Bot] ✅ Recalibrated position opened with enhanced tracking`);
    }
  }, [addPosition]);

  const generateRecalibratedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    
    // Reduced rate limiting for more active trading
    if (timeSinceLastSignal < 2000) {
      console.log(`[Trading Bot] ⏰ Rate limiting: ${2000 - timeSinceLastSignal}ms remaining`);
      return;
    }

    const orderBookImbalance = calculateOrderBookImbalance();
    const deepOrderBookData = calculateDeepOrderBookData();
    const recentPriceMovement = [currentPrice];
    
    const predictionInput = {
      indicators,
      marketContext,
      orderBookImbalance,
      recentPriceMovement,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      deepOrderBookData
    };

    console.log(`[Trading Bot] 🎯 Recalibrated market analysis: Liquidity=${marketContext.liquidityScore.toFixed(3)}, Spread=${marketContext.spreadQuality.toFixed(3)}`);

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    // Get dynamic thresholds from AI model
    const dynamicThresholds = config.useDynamicThresholds ? 
      aiModel.current.getDynamicThresholds() : null;
    
    const adaptiveThresholds = config.useAdaptiveThresholds ? 
      aiModel.current.getAdaptiveThresholds() : null;

    const dynamicConfig = getDynamicConfig(config, marketContext, adaptiveThresholds, dynamicThresholds);

    console.log(`[Trading Bot] 🎯 Recalibrated prediction - Prob: ${newPrediction.probability.toFixed(3)}, Kelly: ${newPrediction.kellyFraction.toFixed(3)}, Feature contributions: ${JSON.stringify(newPrediction.featureContributions)}`);

    if (shouldGenerateRecalibratedSignal(newPrediction, dynamicConfig, marketContext, dynamicThresholds || adaptiveThresholds)) {
      console.log(`[Trading Bot] 🎯 Recalibrated signal conditions met!`);
      const signal = createEnhancedTradingSignal(currentPrice, newPrediction, indicators, marketContext);
      if (signal) {
        console.log(`[Trading Bot] 📤 Executing ${signal.action} signal with optimized Kelly sizing`);
        setSignals(prev => [...prev.slice(-9), signal]);
        executeAdvancedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      }
    } else {
      console.log(`[Trading Bot] ❌ Recalibrated signal conditions not met - awaiting better opportunity`);
    }
  }, [config, getDynamicConfig, activePositions, marketContext, executeAdvancedSignal]);

  const calculateDeepOrderBookData = useCallback(() => {
    if (bids.length < 10 || asks.length < 10) return null;

    const bidDepth = bids.slice(0, 20).map(bid => bid.quantity);
    const askDepth = asks.slice(0, 20).map(ask => ask.quantity);
    
    const topBidValue = bids[0].price * bids[0].quantity;
    const topAskValue = asks[0].price * asks[0].quantity;
    const weightedMidPrice = (topBidValue + topAskValue) / (bids[0].quantity + asks[0].quantity);

    return { bidDepth, askDepth, weightedMidPrice };
  }, [bids, asks]);

  const calculateOrderBookImbalance = useCallback(() => {
    if (bids.length === 0 || asks.length === 0) return 0;
    
    const topBidsVolume = bids.slice(0, 15).reduce((sum, bid) => sum + bid.quantity, 0);
    const topAsksVolume = asks.slice(0, 15).reduce((sum, ask) => sum + ask.quantity, 0);
    const totalVolume = topBidsVolume + topAsksVolume;
    
    if (totalVolume === 0) return 0;
    return (topBidsVolume - topAsksVolume) / totalVolume;
  }, [bids, asks]);

  const shouldGenerateRecalibratedSignal = useCallback((
    prediction: PredictionOutput, 
    dynamicConfig: AdvancedTradingConfig,
    marketContext: MarketContext,
    adaptiveThresholds: any
  ): boolean => {
    // Check each condition individually with enhanced logging
    const probabilityCheck = prediction.probability >= dynamicConfig.minProbability;
    const confidenceCheck = prediction.confidence >= dynamicConfig.minConfidence;
    const riskCheck = prediction.riskScore <= dynamicConfig.maxRiskScore;
    const positionCheck = activePositions.size < dynamicConfig.maxPositionsPerSymbol;

    if (config.debugMode) {
      console.log(`[Signal Debug] 🔍 Recalibrated signal conditions:`);
      console.log(`  - Probability: ${prediction.probability.toFixed(3)} >= ${dynamicConfig.minProbability.toFixed(3)} ✓${probabilityCheck ? '✅' : '❌'}`);
      console.log(`  - Confidence: ${prediction.confidence.toFixed(3)} >= ${dynamicConfig.minConfidence.toFixed(3)} ✓${confidenceCheck ? '✅' : '❌'}`);
      console.log(`  - Risk Score: ${prediction.riskScore.toFixed(3)} <= ${dynamicConfig.maxRiskScore.toFixed(3)} ✓${riskCheck ? '✅' : '❌'}`);
      console.log(`  - Position Count: ${activePositions.size} < ${dynamicConfig.maxPositionsPerSymbol} ✓${positionCheck ? '✅' : '❌'}`);
    }

    const basicConditions = probabilityCheck && confidenceCheck && riskCheck && positionCheck;

    // Enhanced conditions with recalibrated thresholds
    const kellyCondition = !config.useKellyCriterion || 
      !adaptiveThresholds || 
      prediction.kellyFraction >= adaptiveThresholds.kellyThreshold;
    const liquidityCondition = marketContext.liquidityScore >= config.minLiquidityScore;
    const spreadCondition = marketContext.spreadQuality >= config.minSpreadQuality;

    // Enhanced opportunity detection
    const opportunityCondition = !config.enableOpportunityDetection || 
      isMarketOpportunityDetected(prediction, marketContext);

    if (config.debugMode) {
      console.log(`[Signal Debug] 🔍 Enhanced recalibrated conditions:`);
      console.log(`  - Kelly Condition: ${kellyCondition ? '✅' : '❌'} (Kelly: ${prediction.kellyFraction.toFixed(3)})`);
      console.log(`  - Liquidity: ${marketContext.liquidityScore.toFixed(3)} >= ${config.minLiquidityScore.toFixed(3)} ✓${liquidityCondition ? '✅' : '❌'}`);
      console.log(`  - Spread Quality: ${marketContext.spreadQuality.toFixed(3)} >= ${config.minSpreadQuality.toFixed(3)} ✓${spreadCondition ? '✅' : '❌'}`);
      console.log(`  - Opportunity: ${opportunityCondition ? '✅' : '❌'}`);
      console.log(`[Signal Debug] 🎯 Final Result: ${basicConditions && kellyCondition && liquidityCondition && spreadCondition && opportunityCondition ? 'SIGNAL GENERATED' : 'NO SIGNAL'}`);
    }

    return basicConditions && kellyCondition && liquidityCondition && spreadCondition && opportunityCondition;
  }, [activePositions, config]);

  // Enhanced market opportunity detection with more permissive thresholds
  const isMarketOpportunityDetected = useCallback((
    prediction: PredictionOutput,
    marketContext: MarketContext
  ): boolean => {
    // Check for strong feature confluence with lowered threshold
    if (!prediction.featureContributions) return true; // Fallback if not available
    
    const contributions = prediction.featureContributions;
    const strongFeatures = Object.values(contributions).filter(value => Math.abs(value) > 0.08).length; // Lowered from 0.15
    
    // Calculate sum of absolute feature contributions
    const totalFeatureStrength = Object.values(contributions).reduce((sum, value) => sum + Math.abs(value), 0);
    
    // Market opportunity exists if we have strong signals and good market quality
    const hasStrongSignals = strongFeatures >= 2;
    const hasGoodFeatureSum = totalFeatureStrength > 0.25; // New criterion
    const hasGoodMarketQuality = marketContext.liquidityScore > 0.15 && marketContext.spreadQuality > 0.3; // Lowered liquidity from 0.2
    
    // Fallback condition for high-confidence predictions
    const highConfidenceFallback = prediction.confidence > 0.7 && prediction.probability > 0.58;
    
    const isOpportunity = (hasStrongSignals || hasGoodFeatureSum || highConfidenceFallback) && hasGoodMarketQuality;
    
    if (config.debugMode) {
      console.log(`[Opportunity Debug] 🔍 Opportunity detection:`);
      console.log(`  - Strong features (>0.08): ${strongFeatures}/2 required ✓${hasStrongSignals ? '✅' : '❌'}`);
      console.log(`  - Total feature strength: ${totalFeatureStrength.toFixed(3)} > 0.25 ✓${hasGoodFeatureSum ? '✅' : '❌'}`);
      console.log(`  - High confidence fallback: conf=${prediction.confidence.toFixed(3)}>0.7 & prob=${prediction.probability.toFixed(3)}>0.58 ✓${highConfidenceFallback ? '✅' : '❌'}`);
      console.log(`  - Market quality: liquidity=${marketContext.liquidityScore.toFixed(3)}>0.15 & spread=${marketContext.spreadQuality.toFixed(3)}>0.3 ✓${hasGoodMarketQuality ? '✅' : '❌'}`);
      console.log(`  - Final opportunity result: ${isOpportunity ? '✅ OPPORTUNITY DETECTED' : '❌ NO OPPORTUNITY'}`);
    }
    
    return isOpportunity;
  }, [config.debugMode]);

  const createEnhancedTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): TradingSignal | null => {
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    // Enhanced signal logic with feature contributions
    const vwapSignal = indicators.vwap > 0 ? (price - indicators.vwap) / indicators.vwap : 0;
    const orderBookBias = indicators.orderbook_pressure || 0;
    
    // More sophisticated signal generation using feature contributions
    const technicalBias = prediction.featureContributions?.technical || 0;
    const momentumBias = prediction.featureContributions?.momentum || 0;
    
    const combinedBias = technicalBias + momentumBias + (vwapSignal * 0.5) + (orderBookBias * 0.3);
    
    if (prediction.probability > 0.505 && combinedBias > 0.05) {
      action = 'BUY';
    } else if (prediction.probability < 0.495 && combinedBias < -0.05) {
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    if (action === 'HOLD') return null;

    // Optimized Kelly Criterion position sizing
    const basePositionSizeUSD = config.riskPerTrade * 5; // Increased multiplier
    const quantity = calculateKellySizedPosition(basePositionSizeUSD, prediction, price);

    const positionValue = quantity * price;
    const adjustedQuantity = Math.min(quantity, (portfolio.availableBalance / price) * 0.98); // Increased from 0.95

    if (adjustedQuantity !== quantity) {
      console.log(`[Trading Bot] ⚠️ Position size adjusted for available balance. Kelly: ${quantity.toFixed(6)}, Actual: ${adjustedQuantity.toFixed(6)}`);
    }

    return {
      symbol,
      action,
      confidence: prediction.confidence,
      price,
      quantity: adjustedQuantity,
      timestamp: Date.now(),
      reasoning: generateEnhancedSignalReasoning(prediction, indicators, marketContext)
    };
  }, [symbol, config, portfolio.availableBalance, calculateKellySizedPosition]);

  const generateEnhancedSignalReasoning = useCallback((
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): string => {
    const reasons: string[] = [];
    
    // Feature contribution analysis
    if (prediction.featureContributions) {
      const contributions = prediction.featureContributions;
      Object.entries(contributions).forEach(([feature, value]) => {
        if (Math.abs(value) > 0.1) {
          reasons.push(`${feature}: ${value > 0 ? '+' : ''}${value.toFixed(2)}`);
        }
      });
    }
    
    // Technical signals
    if (prediction.features.technical > 0.6) {
      reasons.push('strong technical confluence');
    } else if (prediction.features.technical < -0.6) {
      reasons.push('bearish technical signals');
    }
    
    // VWAP analysis
    if (indicators.vwap > 0 && indicators.bollinger_middle > 0) {
      const vwapDiff = ((indicators.bollinger_middle - indicators.vwap) / indicators.vwap) * 100;
      if (Math.abs(vwapDiff) > 0.08) {
        reasons.push(`${vwapDiff > 0 ? 'above' : 'below'} VWAP by ${Math.abs(vwapDiff).toFixed(2)}%`);
      }
    }
    
    // Order book analysis
    if (Math.abs(indicators.orderbook_pressure || 0) > 0.25) {
      reasons.push(`${indicators.orderbook_pressure > 0 ? 'bullish' : 'bearish'} order flow`);
    }
    
    // Market quality
    reasons.push(`liquidity: ${marketContext.liquidityScore.toFixed(2)}`);
    
    // Enhanced metrics
    reasons.push(`Kelly: ${prediction.kellyFraction.toFixed(3)}`);
    reasons.push(`MAE: ${prediction.maxAdverseExcursion.toFixed(2)}%`);
    
    return reasons.join(', ') || 'Recalibrated AI analysis';
  }, []);

  const checkEnhancedExitConditions = useCallback((currentPrice: number) => {
    const now = Date.now();
    
    activePositions.forEach((tracking, positionId) => {
      const { position, prediction, entryTime, trailingStopPrice, partialProfitsTaken } = tracking;
      const holdingTime = (now - entryTime) / 1000;
      const priceChange = position.side === 'BUY' 
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;

      let shouldExit = false;
      let exitReason = '';
      let isPartialExit = false;
      let exitQuantity = position.size;

      const maxHoldTime = Math.min(prediction.timeHorizon, 120);
      if (holdingTime >= maxHoldTime) {
        shouldExit = true;
        exitReason = 'Optimal time horizon reached';
      }

      if (config.enablePartialProfits && partialProfitsTaken < config.partialProfitLevels.length) {
        const nextProfitLevel = config.partialProfitLevels[partialProfitsTaken] / 100;
        if (priceChange >= nextProfitLevel) {
          shouldExit = true;
          isPartialExit = true;
          exitQuantity = position.size * 0.33;
          exitReason = `Partial profit at ${(nextProfitLevel * 100).toFixed(1)}%`;
        }
      }

      if (config.enableTrailingStop && trailingStopPrice) {
        const hitTrailingStop = position.side === 'BUY' ? 
          currentPrice <= trailingStopPrice : 
          currentPrice >= trailingStopPrice;
        
        if (hitTrailingStop) {
          shouldExit = true;
          exitReason = 'Trailing stop triggered';
        }
      }

      const maeBasedStop = -Math.max(prediction.maxAdverseExcursion / 100, config.stopLossPercentage / 100);
      if (priceChange <= maeBasedStop) {
        shouldExit = true;
        exitReason = 'MAE-based stop loss';
      }

      const dynamicProfitTarget = Math.max(prediction.expectedReturn / 100, 0.008);
      if (priceChange >= dynamicProfitTarget && !isPartialExit) {
        shouldExit = true;
        exitReason = 'Dynamic profit target achieved';
      }

      if (shouldExit) {
        console.log(`[Trading Bot] 🚪 ${isPartialExit ? 'Partial' : 'Full'} exit: ${exitReason}`);
        console.log(`[Trading Bot] 📊 Performance: ${(priceChange * 100).toFixed(2)}% return, ${holdingTime.toFixed(0)}s hold`);
        
        if (isPartialExit) {
          handlePartialExit(positionId, currentPrice, exitQuantity, priceChange, exitReason);
        } else {
          exitPosition(positionId, currentPrice, priceChange, exitReason);
        }
      }
    });
  }, [activePositions, config]);

  const handlePartialExit = useCallback((
    positionId: string,
    exitPrice: number,
    exitQuantity: number,
    actualReturn: number,
    reason: string
  ) => {
    setPortfolio(prev => {
      const updatedPositions = prev.positions.map(p =>
        p.id === positionId ? { ...p, size: p.size - exitQuantity } : p
      );
      
      const updatedPortfolio = {
        ...prev,
        positions: updatedPositions
      };
      
      return PortfolioCalculator.recalculatePortfolio(updatedPortfolio);
    });

    setActivePositions(prev => {
      const updated = new Map(prev);
      const tracking = updated.get(positionId);
      if (tracking) {
        updated.set(positionId, {
          ...tracking,
          partialProfitsTaken: tracking.partialProfitsTaken + 1
        });
      }
      return updated;
    });

    console.log(`[Trading Bot] 📈 Partial profit taken: ${exitQuantity.toFixed(6)} at ${(actualReturn * 100).toFixed(2)}%`);
  }, []);

  const exitPosition = useCallback((
    positionId: string,
    exitPrice: number,
    actualReturn: number,
    reason: string
  ) => {
    const positionData = activePositions.get(positionId);
    if (!positionData) return;

    closePosition(positionId, exitPrice);

    if (config.learningEnabled) {
      const outcome: TradeOutcome = {
        entryPrice: positionData.position.entryPrice,
        exitPrice,
        profitLoss: actualReturn * positionData.position.entryPrice * positionData.position.size,
        holdingTime: (Date.now() - positionData.entryTime) / 1000,
        prediction: positionData.prediction,
        actualReturn: actualReturn * 100,
        success: actualReturn > 0,
        maxAdverseExcursion: positionData.maxAdverseExcursion * 100,
        maxFavorableExcursion: positionData.maxFavorableExcursion * 100
      };

      aiModel.current.updateModel(outcome);
      console.log(`[Trading Bot] 🎓 Recalibrated learning: MFE=${positionData.maxFavorableExcursion.toFixed(3)}, MAE=${positionData.maxAdverseExcursion.toFixed(3)}`);
    }

    setActivePositions(prev => {
      const updated = new Map(prev);
      updated.delete(positionId);
      return updated;
    });
  }, [activePositions, closePosition, config.learningEnabled]);

  const getModelPerformance = useCallback(() => {
    return aiModel.current.getModelPerformance();
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AdvancedTradingConfig>) => {
    console.log(`[Trading Bot] 🔧 Recalibrated configuration updated:`, newConfig);
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    portfolio,
    portfolioReconciliation: null, // Removed reconciliation system
    indicators,
    marketContext,
    prediction,
    activePositions: Array.from(activePositions.values()),
    config,
    updateConfig,
    getModelPerformance,
    technicalAnalysis: technicalAnalysis.current,
    aiModel: aiModel.current,
    signals,
    latestSignal: signals.length > 0 ? signals[signals.length - 1] : null,
    basicIndicators,
    validateAndReconcilePortfolio: () => PortfolioCalculator.recalculatePortfolio(portfolio)
  };
};
