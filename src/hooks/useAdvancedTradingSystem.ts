import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position, Portfolio, TradingConfig as BaseTradingConfig } from '@/types/trading';

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
    minProbability: 0.52,
    minConfidence: 0.45,
    maxRiskScore: 0.70,
    adaptiveSizing: true,
    learningEnabled: true,
    useAdaptiveThresholds: true,
    maxPositionsPerSymbol: 100,
    maxPositionSize: 1500, // Increased for Kelly sizing
    maxDailyLoss: 600,
    stopLossPercentage: 1.2, // Tighter stop loss
    takeProfitPercentage: 2.5,
    maxOpenPositions: 100,
    riskPerTrade: 100,
    enableProfitLock: true,
    profitLockPercentage: 1.0,
    minProfitLockThreshold: 0,
    useKellyCriterion: true,
    maxKellyFraction: 0.15, // Max 15% of capital per trade
    enableTrailingStop: true,
    trailingStopATRMultiplier: 2.0,
    enablePartialProfits: true,
    partialProfitLevels: [0.8, 1.5, 2.2] // Take partial profits at these % levels
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

    if (!hasEnoughBalance) console.log(`[Trading Bot] ❌ Insufficient balance. Available: ${portfolio.availableBalance.toFixed(2)}, Needed: ${positionValue.toFixed(2)}`);
    if (!isUnderMaxPositions) console.log(`[Trading Bot] ❌ Max positions reached. Open: ${openPositions}, Max: ${config.maxOpenPositions}`);
    if (!isUnderMaxSize) console.log(`[Trading Bot] ❌ Position size exceeds max. Size: ${positionValue.toFixed(2)}, Max: ${config.maxPositionSize}`);
    if (!isUnderMaxLoss) console.log(`[Trading Bot] ❌ Daily loss limit reached. PnL: ${portfolio.dayPnL.toFixed(2)}, Max Loss: ${config.maxDailyLoss}`);

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

    setPortfolio(prev => ({
        ...prev,
        positions: [...prev.positions, newPosition],
        availableBalance: prev.availableBalance - positionValue
    }));

    return newPosition;
  }, [canOpenPosition]);

  const closePosition = useCallback((positionId: string, closePrice: number) => {
    setPortfolio(prev => {
      const position = prev.positions.find(p => p.id === positionId);
      if (!position || position.status === 'CLOSED') return prev;

      const realizedPnL = position.side === 'BUY'
        ? (closePrice - position.entryPrice) * position.size
        : (position.entryPrice - closePrice) * position.size;

      const positionValueAtClose = position.size * closePrice;
      
      let newLockedProfits = prev.lockedProfits;
      let newAvailableBalance = prev.availableBalance + positionValueAtClose;

      if (config.enableProfitLock && realizedPnL > 0) {
        const isAboveThreshold = config.minProfitLockThreshold === undefined || realizedPnL >= config.minProfitLockThreshold;
        if (isAboveThreshold) {
          const lockedAmount = realizedPnL * config.profitLockPercentage;
          newLockedProfits += lockedAmount;
          newAvailableBalance -= lockedAmount;
          console.log(`[Profit Lock] 🔒 Locking ${lockedAmount.toFixed(2)} USD profit`);
        }
      }

      return {
        ...prev,
        positions: prev.positions.map(p =>
          p.id === positionId
            ? { ...p, status: 'CLOSED' as const, realizedPnL, currentPrice: closePrice }
            : p
        ),
        availableBalance: newAvailableBalance,
        lockedProfits: newLockedProfits,
        totalPnL: prev.totalPnL + realizedPnL,
        dayPnL: prev.dayPnL + realizedPnL,
      };
    });
  }, [config.enableProfitLock, config.profitLockPercentage, config.minProfitLockThreshold]);

  const updatePositionPrices = useCallback((currentPrice: number) => {
    setPortfolio(prev => {
        const updatedPositions = prev.positions.map(position => {
            if (position.symbol === symbol && position.status === 'OPEN') {
                const unrealizedPnL = position.side === 'BUY'
                    ? (currentPrice - position.entryPrice) * position.size
                    : (position.entryPrice - currentPrice) * position.size;
                return { ...position, currentPrice, unrealizedPnL };
            }
            return position;
        });

        const totalUnrealizedPnL = updatedPositions
            .filter(p => p.status === 'OPEN')
            .reduce((sum, p) => sum + p.unrealizedPnL, 0);

        return {
            ...prev,
            positions: updatedPositions,
            equity: prev.baseCapital + prev.totalPnL + prev.lockedProfits + totalUnrealizedPnL
        };
    });
  }, [symbol]);

  // Enhanced position tracking with MFE/MAE
  const updatePositionTracking = useCallback((currentPrice: number) => {
    setActivePositions(prev => {
      const updated = new Map(prev);
      
      prev.forEach((tracking, positionId) => {
        const { position } = tracking;
        const priceChange = position.side === 'BUY' 
          ? (currentPrice - position.entryPrice) / position.entryPrice
          : (position.entryPrice - currentPrice) / position.entryPrice;

        // Update MFE and MAE
        const newMFE = Math.max(tracking.maxFavorableExcursion, Math.max(0, priceChange));
        const newMAE = Math.min(tracking.maxAdverseExcursion, Math.min(0, priceChange));

        // Update trailing stop
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
      
      console.log(`[Trading Bot] Enhanced price update: ${midPrice.toFixed(2)}, Volume: ${volume.toFixed(4)}`);
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      console.log(`[Trading Bot] Enhanced market analysis - Regime: ${newMarketContext?.marketRegime}, Volatility: ${newMarketContext?.volatilityRegime}, Liquidity: ${newMarketContext?.liquidityScore?.toFixed(3)}`);
      
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
        console.log(`[Trading Bot] 🎯 Enhanced signal generation with VWAP: ${newIndicators.vwap?.toFixed(2)}, Order book pressure: ${newIndicators.orderbook_pressure?.toFixed(3)}`);
        generateAdvancedSignal(midPrice, newIndicators, newMarketContext);
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
    
    console.log(`[Kelly Sizing] Kelly fraction: ${kellyFraction.toFixed(3)}, Position size: ${kellyPositionSize.toFixed(2)} USD`);
    
    return Math.min(kellyPositionSize, config.maxPositionSize) / currentPrice;
  }, [config.useKellyCriterion, config.maxKellyFraction, config.maxPositionSize, portfolio.availableBalance]);

  const getDynamicConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null,
    adaptiveThresholds?: any
  ): AdvancedTradingConfig => {
    if (!marketContext) return baseConfig;

    let thresholds = baseConfig;
    if (baseConfig.useAdaptiveThresholds && adaptiveThresholds) {
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

    // Enhanced regime-based adjustments
    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            probabilityAdjustment = -0.025;
            confidenceAdjustment = -0.04;
            riskAdjustment = 0.06;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            probabilityAdjustment = -0.015;
            confidenceAdjustment = -0.02;
            break;
        case 'SIDEWAYS_VOLATILE':
            probabilityAdjustment = 0.04;
            confidenceAdjustment = 0.06;
            riskAdjustment = -0.12;
            break;
        case 'SIDEWAYS_QUIET':
            probabilityAdjustment = 0.025;
            confidenceAdjustment = 0.04;
            riskAdjustment = -0.06;
            break;
    }

    // Liquidity-based adjustments
    const liquidityAdjustment = (marketContext.liquidityScore - 0.5) * 0.03;
    probabilityAdjustment += liquidityAdjustment;
    
    return {
        ...thresholds,
        minProbability: Math.max(0.50, thresholds.minProbability + probabilityAdjustment),
        minConfidence: Math.max(0.35, thresholds.minConfidence + confidenceAdjustment),
        maxRiskScore: Math.min(0.80, thresholds.maxRiskScore + riskAdjustment)
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

    console.log(`[Trading Bot] 🚀 Executing enhanced signal with Kelly sizing: ${signal.action} ${signal.symbol}`);
    console.log(`[Trading Bot] 📊 Kelly fraction: ${prediction.kellyFraction.toFixed(3)}, Expected MAE: ${prediction.maxAdverseExcursion.toFixed(3)}%`);
    
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

      console.log(`[Trading Bot] ✅ Enhanced position opened with advanced tracking`);
    }
  }, [addPosition]);

  const generateAdvancedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    
    if (timeSinceLastSignal < 2500) { // Reduced for more active trading
      console.log(`[Trading Bot] ⏰ Rate limiting: ${2500 - timeSinceLastSignal}ms remaining`);
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

    console.log(`[Trading Bot] 📈 Enhanced market analysis: Liquidity=${marketContext.liquidityScore.toFixed(3)}, Spread quality=${marketContext.spreadQuality.toFixed(3)}`);

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    const adaptiveThresholds = config.useAdaptiveThresholds ? 
      aiModel.current.getAdaptiveThresholds() : null;

    const dynamicConfig = getDynamicConfig(config, marketContext, adaptiveThresholds);

    console.log(`[Trading Bot] 🎯 Enhanced prediction - Kelly: ${newPrediction.kellyFraction.toFixed(3)}, MAE: ${newPrediction.maxAdverseExcursion.toFixed(3)}%`);

    if (shouldGenerateEnhancedSignal(newPrediction, dynamicConfig, marketContext, adaptiveThresholds)) {
      console.log(`[Trading Bot] 🎯 Enhanced signal conditions met!`);
      const signal = createEnhancedTradingSignal(currentPrice, newPrediction, indicators, marketContext);
      if (signal) {
        console.log(`[Trading Bot] 📤 Executing ${signal.action} signal with Kelly position sizing`);
        setSignals(prev => [...prev.slice(-9), signal]);
        executeAdvancedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      }
    } else {
      console.log(`[Trading Bot] ❌ Enhanced signal conditions not met - optimizing for quality over quantity`);
    }
  }, [config, getDynamicConfig, activePositions, marketContext, executeAdvancedSignal]);

  const calculateDeepOrderBookData = useCallback(() => {
    if (bids.length < 10 || asks.length < 10) return null;

    const bidDepth = bids.slice(0, 20).map(bid => bid.quantity);
    const askDepth = asks.slice(0, 20).map(ask => ask.quantity);
    
    // Calculate volume-weighted mid price
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

  const shouldGenerateEnhancedSignal = useCallback((
    prediction: PredictionOutput, 
    dynamicConfig: AdvancedTradingConfig,
    marketContext: MarketContext,
    adaptiveThresholds: any
  ): boolean => {
    const basicConditions = (
      prediction.probability >= dynamicConfig.minProbability &&
      prediction.confidence >= dynamicConfig.minConfidence &&
      prediction.riskScore <= dynamicConfig.maxRiskScore &&
      activePositions.size < dynamicConfig.maxPositionsPerSymbol
    );

    // Enhanced conditions for better trade quality
    const kellyCondition = !config.useKellyCriterion || 
      !adaptiveThresholds || 
      prediction.kellyFraction >= adaptiveThresholds.kellyThreshold;
    const liquidityCondition = marketContext.liquidityScore >= 0.4;
    const spreadCondition = marketContext.spreadQuality >= 0.3;

    return basicConditions && kellyCondition && liquidityCondition && spreadCondition;
  }, [activePositions, config.useKellyCriterion]);

  const createEnhancedTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): TradingSignal | null => {
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    // Enhanced signal logic with VWAP and order book analysis
    const vwapSignal = indicators.vwap > 0 ? (price - indicators.vwap) / indicators.vwap : 0;
    const orderBookBias = indicators.orderbook_pressure || 0;
    
    // Combined signal approach
    if (prediction.probability > 0.51 && (vwapSignal > -0.001 || orderBookBias > 0.1)) {
      action = 'BUY';
    } else if (prediction.probability < 0.49 && (vwapSignal < 0.001 || orderBookBias < -0.1)) {
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    if (action === 'HOLD') return null;

    // Kelly Criterion position sizing
    const basePositionSizeUSD = config.riskPerTrade * 4;
    const quantity = calculateKellySizedPosition(basePositionSizeUSD, prediction, price);

    // Ensure position doesn't exceed available balance
    const positionValue = quantity * price;
    const adjustedQuantity = Math.min(quantity, (portfolio.availableBalance / price) * 0.95);

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
    
    // Technical signals
    if (prediction.features.technical > 0.6) {
      reasons.push('strong technical confluence');
    } else if (prediction.features.technical < -0.6) {
      reasons.push('bearish technical signals');
    }
    
    // VWAP analysis
    if (indicators.vwap > 0 && indicators.bollinger_middle > 0) {
      const vwapDiff = ((indicators.bollinger_middle - indicators.vwap) / indicators.vwap) * 100;
      if (Math.abs(vwapDiff) > 0.1) {
        reasons.push(`${vwapDiff > 0 ? 'above' : 'below'} VWAP by ${Math.abs(vwapDiff).toFixed(2)}%`);
      }
    }
    
    // Order book analysis
    if (Math.abs(indicators.orderbook_pressure || 0) > 0.3) {
      reasons.push(`${indicators.orderbook_pressure > 0 ? 'bullish' : 'bearish'} order flow`);
    }
    
    // Market quality
    reasons.push(`${marketContext.liquidityScore.toFixed(2)} liquidity score`);
    
    // Enhanced metrics
    reasons.push(`Kelly: ${prediction.kellyFraction.toFixed(3)}`);
    reasons.push(`expected MAE: ${prediction.maxAdverseExcursion.toFixed(2)}%`);
    
    return reasons.join(', ') || 'Enhanced AI analysis';
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

      // Enhanced time-based exit
      const maxHoldTime = Math.min(prediction.timeHorizon, 120);
      if (holdingTime >= maxHoldTime) {
        shouldExit = true;
        exitReason = 'Optimal time horizon reached';
      }

      // Partial profit taking
      if (config.enablePartialProfits && partialProfitsTaken < config.partialProfitLevels.length) {
        const nextProfitLevel = config.partialProfitLevels[partialProfitsTaken] / 100;
        if (priceChange >= nextProfitLevel) {
          shouldExit = true;
          isPartialExit = true;
          exitQuantity = position.size * 0.33; // Take 33% profit
          exitReason = `Partial profit at ${(nextProfitLevel * 100).toFixed(1)}%`;
        }
      }

      // Trailing stop
      if (config.enableTrailingStop && trailingStopPrice) {
        const hitTrailingStop = position.side === 'BUY' ? 
          currentPrice <= trailingStopPrice : 
          currentPrice >= trailingStopPrice;
        
        if (hitTrailingStop) {
          shouldExit = true;
          exitReason = 'Trailing stop triggered';
        }
      }

      // Enhanced stop loss based on MAE
      const maeBasedStop = -Math.max(prediction.maxAdverseExcursion / 100, config.stopLossPercentage / 100);
      if (priceChange <= maeBasedStop) {
        shouldExit = true;
        exitReason = 'MAE-based stop loss';
      }

      // Dynamic profit target
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
    // Update position size
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.id === positionId ? { ...p, size: p.size - exitQuantity } : p
      )
    }));

    // Update tracking
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
      console.log(`[Trading Bot] 🎓 Enhanced learning: MFE=${positionData.maxFavorableExcursion.toFixed(3)}, MAE=${positionData.maxAdverseExcursion.toFixed(3)}`);
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
    console.log(`[Trading Bot] 🔧 Enhanced configuration updated:`, newConfig);
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
  };
};
