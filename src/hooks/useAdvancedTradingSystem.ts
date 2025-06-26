
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position, Portfolio, TradingConfig as BaseTradingConfig } from '@/types/trading';
import { PortfolioCalculator } from '@/services/portfolioCalculator';
import { RealTrainingDataService } from '@/services/realTrainingDataService';

const initialPortfolio: Portfolio = {
  baseCapital: 10000, // Demo mode with $10,000 starting balance
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
  marketContextAtEntry: MarketContext;
  indicatorsAtEntry: AdvancedIndicators;
}

export const useAdvancedTradingSystem = (
  symbol: string,
  bids: any[],
  asks: any[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);

  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.46, // Significantly reduced from 0.48
    minConfidence: 0.25,  // Reduced from 0.30
    maxRiskScore: 0.85,   // Increased from 0.80
    adaptiveSizing: true,
    learningEnabled: true,
    useAdaptiveThresholds: true,
    useDynamicThresholds: true,
    enableOpportunityDetection: true,
    maxPositionsPerSymbol: 100,
    maxPositionSize: 2000, // Increased from 1500
    maxDailyLoss: 800,     // Increased from 600
    stopLossPercentage: 1.0, // Reduced from 1.2
    takeProfitPercentage: 2.0, // Reduced from 2.5
    maxOpenPositions: 100,
    riskPerTrade: 150,     // Increased from 100
    maxHoldTime: 300,      // Added missing property - 5 minutes
    enableProfitLock: true,
    profitLockPercentage: 0.8, // Reduced from 1.0
    minProfitLockThreshold: 0,
    useKellyCriterion: true,
    maxKellyFraction: 0.25, // Increased from 0.20
    enableTrailingStop: true,
    trailingStopATRMultiplier: 1.8, // Reduced from 2.0
    enablePartialProfits: true,
    partialProfitLevels: [0.6, 1.2, 1.8], // More aggressive
    debugMode: true,
    minLiquidityScore: 0.01, // Further reduced
    minSpreadQuality: 0.03   // Further reduced
  });

  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, PositionTracking>>(new Map());

  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [basicIndicators, setBasicIndicators] = useState<BasicTechnicalIndicators | null>(null);

  const technicalAnalysis = useRef(new AdvancedTechnicalAnalysis());
  const aiModel = useRef(new AIPredictionModel());
  const realTrainingService = useRef<RealTrainingDataService | null>(null);
  const lastSignalTime = useRef(0);

  // Initialize real training data service
  useEffect(() => {
    realTrainingService.current = aiModel.current.getRealTrainingDataService();
    console.log(`[Real Trading System] 🚀 Initialized with REAL training data service`);
    console.log(`[Real Trading System] 📊 Demo mode active with $${initialPortfolio.baseCapital.toLocaleString()} starting balance`);
    
    const dataQuality = realTrainingService.current.getDataQuality();
    console.log(`[Real Trading System] 📈 Real data quality:`, dataQuality);
  }, []);

  const canOpenPosition = useCallback((positionValue: number): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN').length;
    
    const hasEnoughBalance = portfolio.availableBalance >= positionValue;
    const isUnderMaxPositions = openPositions < config.maxOpenPositions;
    const isUnderMaxSize = positionValue <= config.maxPositionSize;
    const isUnderMaxLoss = Math.abs(portfolio.dayPnL) < config.maxDailyLoss;

    if (config.debugMode) {
      console.log(`[Real Trading System] 💰 Position validation (Demo mode):`);
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
        console.log(`[Real Trading System] ❌ Cannot open position: Risk limits exceeded`);
        return null;
    }

    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      unrealizedPnL: 0,
      realizedPnL: 0,
      status: 'OPEN'
    };

    console.log(`[Real Trading System] 📍 Adding DEMO position: ${newPosition.side} ${newPosition.size.toFixed(6)} ${newPosition.symbol} at ${newPosition.entryPrice.toFixed(2)}`);

    setPortfolio(prev => {
        const updatedPositions = [...prev.positions, newPosition];
        const updatedPortfolio = {
            ...prev,
            positions: updatedPositions
        };
        
        return PortfolioCalculator.recalculatePortfolio(updatedPortfolio);
    });

    console.log(`[Real Trading System] ✅ DEMO position opened: ${newPosition.side} ${newPosition.size.toFixed(6)} ${newPosition.symbol} at ${newPosition.entryPrice.toFixed(2)}`);
    return newPosition;
  }, [canOpenPosition]);

  const closePosition = useCallback((positionId: string, closePrice: number) => {
    console.log(`[Real Trading System] 🚪 Closing DEMO position ${positionId} at price ${closePrice.toFixed(2)}`);
    
    setPortfolio(prev => {
      const position = prev.positions.find(p => p.id === positionId);
      if (!position || position.status === 'CLOSED') {
        console.warn(`[Real Trading System] ⚠️ Position ${positionId} not found or already closed`);
        return prev;
      }

      const realizedPnL = position.side === 'BUY'
        ? (closePrice - position.entryPrice) * position.size
        : (position.entryPrice - closePrice) * position.size;

      console.log(`[Real Trading System] 💵 DEMO P&L calculated: ${realizedPnL.toFixed(6)}`);

      let newLockedProfits = prev.lockedProfits;

      if (config.enableProfitLock && realizedPnL > 0) {
        const isAboveThreshold = config.minProfitLockThreshold === undefined || realizedPnL >= config.minProfitLockThreshold;
        if (isAboveThreshold) {
          const lockedAmount = realizedPnL * config.profitLockPercentage;
          newLockedProfits += lockedAmount;
          console.log(`[Real Trading System] 🔒 Locking ${lockedAmount.toFixed(2)} USD profit (DEMO mode)`);
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

      console.log(`[Real Trading System] 🚪 DEMO position closed: ${position.symbol} P&L: ${realizedPnL.toFixed(2)} USD`);

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

        const recalculated = PortfolioCalculator.recalculatePortfolio(updatedPortfolio);

        if (config.debugMode && Math.abs(recalculated.equity - prev.equity) > 0.01) {
          console.log(`[Real Trading System] 🔄 DEMO price update: Equity ${prev.equity.toFixed(6)} → ${recalculated.equity.toFixed(6)}`);
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
      
      console.log(`[Real Trading System] 🚀 REAL DATA: Enhanced signal generation - Price: ${midPrice.toFixed(2)}, Volume: ${volume.toFixed(4)}`);
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      console.log(`[Real Trading System] 🎯 REAL DATA: Market analysis - Regime: ${newMarketContext?.marketRegime}, Volatility: ${newMarketContext?.volatilityRegime}, Liquidity: ${newMarketContext?.liquidityScore?.toFixed(3)}`);
      
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
        console.log(`[Real Trading System] 🚀 REAL DATA: Generating signals with real market data and training`);
        generateOptimizedSignal(midPrice, newIndicators, newMarketContext);
      } else {
        console.log(`[Real Trading System] Awaiting sufficient data - History: ${technicalAnalysis.current.getPriceHistoryLength()}/20`);
      }
    }
  }, [bids, asks]);

  useEffect(() => {
    if (activePositions.size > 0 && bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      checkOptimizedExitConditions(currentPrice);
    }
  }, [bids, asks, activePositions]);

  const calculateOptimizedKellySizedPosition = useCallback((
    basePositionSizeUSD: number,
    prediction: PredictionOutput,
    currentPrice: number
  ): number => {
    if (!config.useKellyCriterion) {
      return basePositionSizeUSD / currentPrice;
    }

    const kellyFraction = Math.min(prediction.kellyFraction, config.maxKellyFraction);
    const kellyPositionSize = portfolio.availableBalance * kellyFraction;
    
    console.log(`[OPTIMIZED Kelly] 🎯 Enhanced Kelly fraction: ${kellyFraction.toFixed(3)}, Position size: ${kellyPositionSize.toFixed(2)} USD`);
    
    return Math.min(kellyPositionSize, config.maxPositionSize) / currentPrice;
  }, [config.useKellyCriterion, config.maxKellyFraction, config.maxPositionSize, portfolio.availableBalance]);

  const getDynamicOptimizedConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null,
    adaptiveThresholds?: any,
    dynamicThresholds?: any
  ): AdvancedTradingConfig => {
    if (!marketContext) return baseConfig;

    let thresholds = baseConfig;
    
    if (baseConfig.useDynamicThresholds && dynamicThresholds) {
      thresholds = {
        ...baseConfig,
        minProbability: dynamicThresholds.minProbability,
        minConfidence: dynamicThresholds.minConfidence,
        maxRiskScore: dynamicThresholds.maxRiskScore
      };
      console.log(`[OPTIMIZED Config] 🚀 Using enhanced dynamic thresholds - Prob: ${dynamicThresholds.minProbability.toFixed(3)}, Conf: ${dynamicThresholds.minConfidence.toFixed(3)}`);
    } else if (baseConfig.useAdaptiveThresholds && adaptiveThresholds) {
      thresholds = {
        ...baseConfig,
        minProbability: adaptiveThresholds.minProbability,
        minConfidence: adaptiveThresholds.minConfidence,
        maxRiskScore: adaptiveThresholds.maxRiskScore
      };
    }

    // More aggressive regime-based adjustments
    let probabilityAdjustment = 0;
    let confidenceAdjustment = 0;
    let riskAdjustment = 0;

    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            probabilityAdjustment = -0.02; // More aggressive
            confidenceAdjustment = -0.03;
            riskAdjustment = 0.06;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            probabilityAdjustment = -0.015; // More aggressive
            confidenceAdjustment = -0.02;
            break;
        case 'SIDEWAYS_VOLATILE':
            probabilityAdjustment = 0.015; // Less conservative
            confidenceAdjustment = 0.025;
            riskAdjustment = -0.05;
            break;
        case 'SIDEWAYS_QUIET':
            probabilityAdjustment = 0.01;
            confidenceAdjustment = 0.015;
            riskAdjustment = -0.03;
            break;
    }

    const liquidityAdjustment = (marketContext.liquidityScore - 0.5) * 0.035; // More aggressive
    probabilityAdjustment += liquidityAdjustment;
    
    return {
        ...thresholds,
        minProbability: Math.max(0.42, thresholds.minProbability + probabilityAdjustment), // Lowered floor
        minConfidence: Math.max(0.20, thresholds.minConfidence + confidenceAdjustment), // Lowered floor
        maxRiskScore: Math.min(0.90, thresholds.maxRiskScore + riskAdjustment) // Raised ceiling
    };
  }, []);

  const executeOptimizedSignal = useCallback((
    signal: TradingSignal,
    prediction: PredictionOutput
  ) => {
    if (signal.action === 'HOLD') {
      console.warn(`[Real Trading System] ⚠️ Attempted to execute a 'HOLD' signal.`);
      return;
    }

    console.log(`[Real Trading System] 🚀 REAL DATA: Executing signal with real training data: ${signal.action} ${signal.symbol}`);
    console.log(`[Real Trading System] 📊 REAL DATA: Metrics - Kelly: ${prediction.kellyFraction.toFixed(3)}, Features: ${JSON.stringify(prediction.featureContributions)}`);
    
    const newPosition = addPosition({
      symbol: signal.symbol,
      side: signal.action,
      size: signal.quantity,
      entryPrice: signal.price,
      currentPrice: signal.price,
      timestamp: signal.timestamp
    });

    if (newPosition && indicators && marketContext) {
      setActivePositions(prev => new Map(prev.set(newPosition.id, {
        position: newPosition,
        prediction,
        entryTime: Date.now(),
        maxFavorableExcursion: 0,
        maxAdverseExcursion: 0,
        partialProfitsTaken: 0,
        marketContextAtEntry: { ...marketContext },
        indicatorsAtEntry: { ...indicators }
      })));

      console.log(`[Real Trading System] ✅ REAL DATA: Position opened with real market context tracking`);
    }
  }, [addPosition, indicators, marketContext]);

  const generateOptimizedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    
    // Reduced rate limiting for more active trading
    if (timeSinceLastSignal < 1500) { // Reduced from 2000ms
      console.log(`[Real Trading System] ⏰ OPTIMIZED: Rate limiting: ${1500 - timeSinceLastSignal}ms remaining`);
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

    console.log(`[Real Trading System] 🚀 OPTIMIZED: Enhanced market analysis: Liquidity=${marketContext.liquidityScore.toFixed(3)}, Spread=${marketContext.spreadQuality.toFixed(3)}`);

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    const dynamicThresholds = config.useDynamicThresholds ? 
      aiModel.current.getDynamicThresholds() : null;
    
    const adaptiveThresholds = config.useAdaptiveThresholds ? 
      aiModel.current.getAdaptiveThresholds() : null;

    const dynamicConfig = getDynamicOptimizedConfig(config, marketContext, adaptiveThresholds, dynamicThresholds);

    console.log(`[Real Trading System] 🚀 OPTIMIZED: Enhanced prediction - Prob: ${newPrediction.probability.toFixed(3)}, Kelly: ${newPrediction.kellyFraction.toFixed(3)}, Feature contributions: ${JSON.stringify(newPrediction.featureContributions)}`);

    if (shouldGenerateOptimizedSignal(newPrediction, dynamicConfig, marketContext, dynamicThresholds || adaptiveThresholds)) {
      console.log(`[Real Trading System] 🚀 OPTIMIZED: Enhanced signal conditions met!`);
      const signal = createOptimizedTradingSignal(currentPrice, newPrediction, indicators, marketContext);
      if (signal) {
        console.log(`[Real Trading System] 📤 OPTIMIZED: Executing ${signal.action} signal with enhanced Kelly sizing`);
        setSignals(prev => [...prev.slice(-9), signal]);
        executeOptimizedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      }
    } else {
      console.log(`[Real Trading System] ❌ OPTIMIZED: Signal conditions not met - but thresholds are more aggressive now`);
    }
  }, [config, getDynamicOptimizedConfig, activePositions, marketContext, executeOptimizedSignal]);

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

  const shouldGenerateOptimizedSignal = useCallback((
    prediction: PredictionOutput, 
    dynamicConfig: AdvancedTradingConfig,
    marketContext: MarketContext,
    adaptiveThresholds: any
  ): boolean => {
    const probabilityCheck = prediction.probability >= dynamicConfig.minProbability;
    const confidenceCheck = prediction.confidence >= dynamicConfig.minConfidence;
    const riskCheck = prediction.riskScore <= dynamicConfig.maxRiskScore;
    const positionCheck = activePositions.size < dynamicConfig.maxPositionsPerSymbol;

    if (config.debugMode) {
      console.log(`[OPTIMIZED Signal] 🚀 Enhanced signal conditions:`);
      console.log(`  - Probability: ${prediction.probability.toFixed(3)} >= ${dynamicConfig.minProbability.toFixed(3)} ✓${probabilityCheck ? '✅' : '❌'}`);
      console.log(`  - Confidence: ${prediction.confidence.toFixed(3)} >= ${dynamicConfig.minConfidence.toFixed(3)} ✓${confidenceCheck ? '✅' : '❌'}`);
      console.log(`  - Risk Score: ${prediction.riskScore.toFixed(3)} <= ${dynamicConfig.maxRiskScore.toFixed(3)} ✓${riskCheck ? '✅' : '❌'}`);
      console.log(`  - Position Count: ${activePositions.size} < ${dynamicConfig.maxPositionsPerSymbol} ✓${positionCheck ? '✅' : '❌'}`);
    }

    const basicConditions = probabilityCheck && confidenceCheck && riskCheck && positionCheck;

    // FIXED: Much more permissive Kelly condition with better fallbacks
    const kellyThreshold = adaptiveThresholds?.kellyThreshold ? adaptiveThresholds.kellyThreshold * 0.3 : 0.01; // Reduced multiplier from 0.7 to 0.3
    const kellyCondition = !config.useKellyCriterion || 
      !adaptiveThresholds || 
      prediction.kellyFraction >= kellyThreshold ||
      (prediction.confidence > 0.6 && prediction.probability > 0.52); // Enhanced fallback
    
    const liquidityCondition = marketContext.liquidityScore >= config.minLiquidityScore;
    const spreadCondition = marketContext.spreadQuality >= config.minSpreadQuality;

    const opportunityCondition = !config.enableOpportunityDetection || 
      isOptimizedMarketOpportunityDetected(prediction, marketContext);

    // ENHANCED: Additional fallback for high-confidence predictions
    const highConfidenceFallback = prediction.confidence > 0.65 && prediction.probability > 0.51; // More permissive
    const basicVolatilityFallback = marketContext.volatilityRegime === 'HIGH' && prediction.probability > 0.505;

    if (config.debugMode) {
      console.log(`[OPTIMIZED Signal] 🚀 Enhanced conditions:`);
      console.log(`  - Kelly Condition: ${kellyCondition ? '✅' : '❌'} (Kelly: ${prediction.kellyFraction.toFixed(3)}, Threshold: ${kellyThreshold.toFixed(3)})`);
      console.log(`  - Liquidity: ${marketContext.liquidityScore.toFixed(3)} >= ${config.minLiquidityScore.toFixed(3)} ✓${liquidityCondition ? '✅' : '❌'}`);
      console.log(`  - Spread Quality: ${marketContext.spreadQuality.toFixed(3)} >= ${config.minSpreadQuality.toFixed(3)} ✓${spreadCondition ? '✅' : '❌'}`);
      console.log(`  - Opportunity: ${opportunityCondition ? '✅' : '❌'}`);
      console.log(`  - High Confidence Fallback: ${highConfidenceFallback ? '✅' : '❌'}`);
      console.log(`  - Basic Volatility Fallback: ${basicVolatilityFallback ? '✅' : '❌'}`);
    }

    const finalResult = (basicConditions && kellyCondition && liquidityCondition && spreadCondition && opportunityCondition) ||
                       (basicConditions && highConfidenceFallback && liquidityCondition) ||
                       (basicConditions && basicVolatilityFallback && liquidityCondition);

    if (config.debugMode) {
      console.log(`[OPTIMIZED Signal] 🎯 Final Result: ${finalResult ? 'SIGNAL GENERATED ✅' : 'NO SIGNAL ❌'}`);
    }

    return finalResult;
  }, [activePositions, config]);

  const isOptimizedMarketOpportunityDetected = useCallback((
    prediction: PredictionOutput,
    marketContext: MarketContext
  ): boolean => {
    if (!prediction.featureContributions) return true;
    
    const contributions = prediction.featureContributions;
    
    // ENHANCED: More aggressive opportunity detection
    const strongFeatures = Object.values(contributions).filter(value => Math.abs(value) > 0.04).length; // Further reduced from 0.06 to 0.04
    const totalFeatureStrength = Object.values(contributions).reduce((sum, value) => sum + Math.abs(value), 0);
    
    const hasStrongSignals = strongFeatures >= 1; // Reduced from 2 to 1
    const hasGoodFeatureSum = totalFeatureStrength > 0.15; // Reduced from 0.20 to 0.15
    const hasGoodMarketQuality = marketContext.liquidityScore > 0.05 && marketContext.spreadQuality > 0.15; // More permissive
    
    // Enhanced fallbacks
    const highConfidenceFallback = prediction.confidence > 0.55 && prediction.probability > 0.51; // More permissive
    const momentumFallback = Math.abs(contributions.momentum || 0) > 0.03 || Math.abs(contributions.technical || 0) > 0.03;
    const volatilityOpportunity = marketContext.volatilityRegime === 'HIGH' && prediction.probability > 0.505;
    
    const isOpportunity = (hasStrongSignals || hasGoodFeatureSum || highConfidenceFallback || momentumFallback || volatilityOpportunity) && hasGoodMarketQuality;
    
    if (config.debugMode) {
      console.log(`[OPTIMIZED Opportunity] 🚀 Enhanced opportunity detection:`);
      console.log(`  - Strong features (>0.04): ${strongFeatures}/1 required ✓${hasStrongSignals ? '✅' : '❌'}`);
      console.log(`  - Total feature strength: ${totalFeatureStrength.toFixed(3)} > 0.15 ✓${hasGoodFeatureSum ? '✅' : '❌'}`);
      console.log(`  - High confidence fallback: conf=${prediction.confidence.toFixed(3)}>0.55 & prob=${prediction.probability.toFixed(3)}>0.51 ✓${highConfidenceFallback ? '✅' : '❌'}`);
      console.log(`  - Momentum fallback: ${momentumFallback ? '✅' : '❌'}`);
      console.log(`  - Volatility opportunity: ${volatilityOpportunity ? '✅' : '❌'}`);
      console.log(`  - Market quality: liquidity=${marketContext.liquidityScore.toFixed(3)}>0.05 & spread=${marketContext.spreadQuality.toFixed(3)}>0.15 ✓${hasGoodMarketQuality ? '✅' : '❌'}`);
      console.log(`  - Final opportunity result: ${isOpportunity ? '✅ OPPORTUNITY DETECTED' : '❌ NO OPPORTUNITY'}`);
    }
    
    return isOpportunity;
  }, [config.debugMode]);

  const createOptimizedTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): TradingSignal | null => {
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    const vwapSignal = indicators.vwap > 0 ? (price - indicators.vwap) / indicators.vwap : 0;
    const orderBookBias = indicators.orderbook_pressure || 0;
    
    const technicalBias = prediction.featureContributions?.technical || 0;
    const momentumBias = prediction.featureContributions?.momentum || 0;
    
    const combinedBias = technicalBias + momentumBias + (vwapSignal * 0.5) + (orderBookBias * 0.3);
    
    // ENHANCED: More aggressive signal generation with additional fallbacks
    if (prediction.probability > 0.501 && combinedBias > 0.02) { // More permissive
      action = 'BUY';
    } else if (prediction.probability < 0.499 && combinedBias < -0.02) { // More permissive
      action = 'SELL';
    } else if (prediction.confidence > 0.7 && prediction.probability > 0.52) { // High confidence fallback
      action = 'BUY';
    } else if (prediction.confidence > 0.7 && prediction.probability < 0.48) { // High confidence fallback
      action = 'SELL';
    } else if (marketContext.volatilityRegime === 'HIGH' && Math.abs(combinedBias) > 0.015) { // Volatility-based fallback
      action = combinedBias > 0 ? 'BUY' : 'SELL';
    } else {
      action = 'HOLD';
    }

    if (action === 'HOLD') {
      console.log(`[Trading Signal] ❌ No clear signal - Prob: ${prediction.probability.toFixed(3)}, Bias: ${combinedBias.toFixed(3)}, Conf: ${prediction.confidence.toFixed(3)}`);
      return null;
    }

    // ENHANCED: Adaptive position sizing with Kelly fallbacks
    let basePositionSizeUSD = config.riskPerTrade * 6; // Increased multiplier
    
    // If Kelly is very low, use reduced position sizing
    if (prediction.kellyFraction < 0.02) {
      basePositionSizeUSD = config.riskPerTrade * 3; // Reduced fallback size
      console.log(`[Trading Signal] 📉 Using reduced position size due to low Kelly: ${basePositionSizeUSD}`);
    }
    
    const quantity = calculateOptimizedKellySizedPosition(basePositionSizeUSD, prediction, price);
    const adjustedQuantity = Math.min(quantity, (portfolio.availableBalance / price) * 0.99); // More aggressive

    if (adjustedQuantity !== quantity) {
      console.log(`[Trading Signal] ⚠️ OPTIMIZED: Position size adjusted for available balance. Kelly: ${quantity.toFixed(6)}, Actual: ${adjustedQuantity.toFixed(6)}`);
    }

    console.log(`[Trading Signal] ✅ Signal created: ${action} ${adjustedQuantity.toFixed(6)} at ${price.toFixed(2)} (Kelly: ${prediction.kellyFraction.toFixed(3)})`);

    return {
      symbol,
      action,
      confidence: prediction.confidence,
      price,
      quantity: adjustedQuantity,
      timestamp: Date.now(),
      reasoning: generateOptimizedSignalReasoning(prediction, indicators, marketContext)
    };
  }, [symbol, config, portfolio.availableBalance, calculateOptimizedKellySizedPosition]);

  const generateOptimizedSignalReasoning = useCallback((
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): string => {
    const reasons: string[] = [];
    
    if (prediction.featureContributions) {
      const contributions = prediction.featureContributions;
      Object.entries(contributions).forEach(([feature, value]) => {
        if (Math.abs(value) > 0.08) { // Lowered from 0.1
          reasons.push(`${feature}: ${value > 0 ? '+' : ''}${value.toFixed(2)}`);
        }
      });
    }
    
    if (prediction.features.technical > 0.55) { // Lowered from 0.6
      reasons.push('strong technical confluence');
    } else if (prediction.features.technical < -0.55) {
      reasons.push('bearish technical signals');
    }
    
    if (indicators.vwap > 0 && indicators.bollinger_middle > 0) {
      const vwapDiff = ((indicators.bollinger_middle - indicators.vwap) / indicators.vwap) * 100;
      if (Math.abs(vwapDiff) > 0.06) { // Lowered from 0.08
        reasons.push(`${vwapDiff > 0 ? 'above' : 'below'} VWAP by ${Math.abs(vwapDiff).toFixed(2)}%`);
      }
    }
    
    if (Math.abs(indicators.orderbook_pressure || 0) > 0.20) { // Lowered from 0.25
      reasons.push(`${indicators.orderbook_pressure > 0 ? 'bullish' : 'bearish'} order flow`);
    }
    
    reasons.push(`liquidity: ${marketContext.liquidityScore.toFixed(2)}`);
    reasons.push(`Kelly: ${prediction.kellyFraction.toFixed(3)}`);
    reasons.push(`MAE: ${prediction.maxAdverseExcursion.toFixed(2)}%`);
    
    return reasons.join(', ') || 'Optimized AI analysis';
  }, []);

  const checkOptimizedExitConditions = useCallback((currentPrice: number) => {
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

      const maxHoldTime = Math.min(prediction.timeHorizon, 100); // Reduced from 120
      if (holdingTime >= maxHoldTime) {
        shouldExit = true;
        exitReason = 'Optimal time horizon reached';
      }

      if (config.enablePartialProfits && partialProfitsTaken < config.partialProfitLevels.length) {
        const nextProfitLevel = config.partialProfitLevels[partialProfitsTaken] / 100;
        if (priceChange >= nextProfitLevel) {
          shouldExit = true;
          isPartialExit = true;
          exitQuantity = position.size * 0.4; // Increased from 0.33
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

      const dynamicProfitTarget = Math.max(prediction.expectedReturn / 100, 0.006); // Lowered from 0.008
      if (priceChange >= dynamicProfitTarget && !isPartialExit) {
        shouldExit = true;
        exitReason = 'Dynamic profit target achieved';
      }

      if (shouldExit) {
        console.log(`[Real Trading System] 🚪 OPTIMIZED: ${isPartialExit ? 'Partial' : 'Full'} exit: ${exitReason}`);
        console.log(`[Real Trading System] 📊 OPTIMIZED: Performance: ${(priceChange * 100).toFixed(2)}% return, ${holdingTime.toFixed(0)}s hold`);
        
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

    console.log(`[Real Trading System] 📈 OPTIMIZED: Partial profit taken: ${exitQuantity.toFixed(6)} at ${(actualReturn * 100).toFixed(2)}%`);
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

    if (config.learningEnabled && realTrainingService.current) {
      // Record this real trade in the training data service
      const returnPercentage = actualReturn * 100;
      
      realTrainingService.current.recordRealTrade(
        positionData.position.symbol,
        positionData.position.entryPrice,
        exitPrice,
        positionData.position.size,
        positionData.position.side,
        positionData.entryTime,
        Date.now(),
        positionData.maxFavorableExcursion * 100,
        positionData.maxAdverseExcursion * 100,
        positionData.marketContextAtEntry,
        positionData.indicatorsAtEntry,
        positionData.prediction,
        reason
      );

      // Also update the AI model with the real outcome
      const outcome: TradeOutcome = {
        entryPrice: positionData.position.entryPrice,
        exitPrice,
        profitLoss: actualReturn * positionData.position.entryPrice * positionData.position.size,
        holdingTime: (Date.now() - positionData.entryTime) / 1000,
        prediction: positionData.prediction,
        actualReturn: returnPercentage,
        success: actualReturn > 0,
        maxAdverseExcursion: positionData.maxAdverseExcursion * 100,
        maxFavorableExcursion: positionData.maxFavorableExcursion * 100
      };

      aiModel.current.updateModel(outcome);
      
      console.log(`[Real Trading System] 🎓 REAL DATA: Learning from real trade - MFE=${positionData.maxFavorableExcursion.toFixed(3)}, MAE=${positionData.maxAdverseExcursion.toFixed(3)}`);
      console.log(`[Real Trading System] 📊 REAL DATA: Trade recorded in training dataset for future model improvement`);
    }

    setActivePositions(prev => {
      const updated = new Map(prev);
      updated.delete(positionId);
      return updated;
    });
  }, [activePositions, closePosition, config.learningEnabled]);

  const getModelPerformance = useCallback(() => {
    const performance = aiModel.current.getModelPerformance();
    
    console.log(`[Real Trading System] 📊 REAL DATA Performance:`, {
      isUsingRealData: performance.isUsingRealData,
      totalRealTrades: performance.realDataStats?.totalTrades || 0,
      realWinRate: performance.realDataStats?.winRate || 0,
      dataQuality: performance.dataQuality
    });
    
    return performance;
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AdvancedTradingConfig>) => {
    console.log(`[Real Trading System] 🔧 REAL DATA: Configuration updated:`, newConfig);
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
    portfolio,
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
    validateAndReconcilePortfolio: () => PortfolioCalculator.recalculatePortfolio(portfolio),
    // Expose real training data service for debugging
    realTrainingDataService: realTrainingService.current
  };
};
