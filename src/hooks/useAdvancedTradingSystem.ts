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
  minProfitLockThreshold?: number; // Minimum profit in USD to trigger locking
}

export const useAdvancedTradingSystem = (
  symbol: string,
  bids: any[],
  asks: any[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);

  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.52, // Lowered from 0.55
    minConfidence: 0.45, // Lowered from 0.50
    maxRiskScore: 0.75, // Lowered from 0.8
    adaptiveSizing: true,
    learningEnabled: true,
    useAdaptiveThresholds: true,
    maxPositionsPerSymbol: 100,
    maxPositionSize: 1000,
    maxDailyLoss: 500,
    stopLossPercentage: 1.5, // Tighter stop loss
    takeProfitPercentage: 3.0, // Lower take profit for quicker exits
    maxOpenPositions: 100,
    riskPerTrade: 100,
    enableProfitLock: true,
    profitLockPercentage: 0.5, // Lock 50% of profits
    minProfitLockThreshold: 10, // Only lock profits on trades that make > $10
  });

  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, {
    position: Position;
    prediction: PredictionOutput;
    entryTime: number;
  }>>(new Map());

  // New state variables for backward compatibility
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

    if (!hasEnoughBalance) console.error(`[Trading Bot] ❌ Check failed: Insufficient balance. Available: ${portfolio.availableBalance.toFixed(2)}, Needed: ${positionValue.toFixed(2)}`);
    if (!isUnderMaxPositions) console.error(`[Trading Bot] ❌ Check failed: Max open positions reached. Open: ${openPositions}, Max: ${config.maxOpenPositions}`);
    if (!isUnderMaxSize) console.error(`[Trading Bot] ❌ Check failed: Position size exceeds max. Size: ${positionValue.toFixed(2)}, Max: ${config.maxPositionSize}`);
    if (!isUnderMaxLoss) console.error(`[Trading Bot] ❌ Check failed: Max daily loss exceeded. PnL: ${portfolio.dayPnL.toFixed(2)}, Max Loss: ${config.maxDailyLoss}`);

    return (
      hasEnoughBalance &&
      isUnderMaxPositions &&
      isUnderMaxSize &&
      isUnderMaxLoss
    );
  }, [portfolio, config]);

  const addPosition = useCallback((position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>): Position | null => {
    const positionValue = position.size * position.entryPrice;
    if (!canOpenPosition(positionValue)) {
        console.error(`[Trading Bot] ❌ Cannot open position: Risk limits exceeded or insufficient funds.`);
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
          console.log(`[Profit Lock] 🔒 Locking ${lockedAmount.toFixed(2)} USD (${config.profitLockPercentage * 100}%) of ${realizedPnL.toFixed(2)} profit.`);
        } else {
          console.log(`[Profit Lock] ℹ️ Profit ${realizedPnL.toFixed(2)} USD is below threshold of ${config.minProfitLockThreshold}. Not locking.`);
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
            equity: prev.baseCapital + prev.totalPnL + totalUnrealizedPnL
        };
    });
  }, [symbol]);

  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      updatePositionPrices(currentPrice);
    }
  }, [bids, asks, updatePositionPrices]);

  // Enhanced price data processing
  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      const volume = bids[0].quantity + asks[0].quantity;
      
      console.log(`[Trading Bot] Enhanced price update: ${midPrice.toFixed(2)}, Volume: ${volume.toFixed(4)}`);
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      console.log(`[Trading Bot] Market analysis - Regime: ${newMarketContext?.marketRegime}, Volatility: ${newMarketContext?.volatilityRegime}`);
      
      setIndicators(newIndicators);
      setMarketContext(newMarketContext);

      // Calculate basic indicators for classic view compatibility
      const priceHistory = technicalAnalysis.current.getPriceHistory();
      if (priceHistory.length >= 20 && newIndicators) {
        const sma_fast = priceHistory.slice(-priceHistory.length, -priceHistory.length + 5).reduce((a, b) => a + b, 0) / 5;
        const sma_slow = priceHistory.slice(-priceHistory.length, -priceHistory.length + 20).reduce((a, b) => a + b, 0) / 20;
        setBasicIndicators({
          rsi: newIndicators.rsi_14,
          ema_fast: sma_fast, // Note: This is an SMA, matching old hook's logic.
          ema_slow: sma_slow, // Note: This is an SMA, matching old hook's logic.
          macd: newIndicators.macd,
          signal: newIndicators.macd_signal,
          volume_ratio: newIndicators.volume_ratio,
        });
      }
      
      if (newIndicators && newMarketContext) {
        console.log(`[Trading Bot] Generating enhanced signal for price ${midPrice.toFixed(2)}`);
        generateAdvancedSignal(midPrice, newIndicators, newMarketContext);
      } else {
        console.log(`[Trading Bot] Awaiting sufficient data - History: ${technicalAnalysis.current.getPriceHistoryLength()}/20`);
      }
    }
  }, [bids, asks]);

  // Enhanced position monitoring
  useEffect(() => {
    if (activePositions.size > 0 && bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      checkExitConditions(currentPrice);
    }
  }, [bids, asks, activePositions]);

  const getDynamicConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null,
    adaptiveThresholds?: any
  ): AdvancedTradingConfig => {
    if (!marketContext) return baseConfig;

    // Use adaptive thresholds if enabled
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

    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            probabilityAdjustment = -0.02; // More aggressive in trending markets
            confidenceAdjustment = -0.03;
            riskAdjustment = 0.05;
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            probabilityAdjustment = -0.01;
            break;
        case 'SIDEWAYS_VOLATILE':
            probabilityAdjustment = 0.03;
            confidenceAdjustment = 0.05;
            riskAdjustment = -0.1;
            break;
        case 'SIDEWAYS_QUIET':
            probabilityAdjustment = 0.02;
            confidenceAdjustment = 0.03;
            riskAdjustment = -0.05;
            break;
    }
    
    return {
        ...thresholds,
        minProbability: Math.max(0.50, thresholds.minProbability + probabilityAdjustment),
        minConfidence: Math.max(0.35, thresholds.minConfidence + confidenceAdjustment),
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

    console.log(`[Trading Bot] 🚀 Executing optimized signal: ${signal.action} ${signal.quantity} ${signal.symbol} at ${signal.price.toFixed(2)}`);
    
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
        entryTime: Date.now()
      })));

      console.log(`[Trading Bot] ✅ Enhanced position opened: ${signal.action} ${signal.symbol}`);
      console.log(`[Trading Bot] 📊 Prediction metrics - Prob: ${prediction.probability.toFixed(3)}, Conf: ${prediction.confidence.toFixed(3)}, Expected: ${prediction.expectedReturn.toFixed(3)}%`);
    }
  }, [addPosition]);

  const generateAdvancedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    // Reduced cooldown for more active trading
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    console.log(`[Trading Bot] Signal cooldown: ${timeSinceLastSignal}ms / 3000ms`);
    
    if (timeSinceLastSignal < 3000) { // Reduced from 5000ms
      console.log(`[Trading Bot] ⏰ Rate limiting: ${3000 - timeSinceLastSignal}ms remaining`);
      return;
    }

    const orderBookImbalance = calculateOrderBookImbalance();
    const recentPriceMovement = [currentPrice];
    
    const predictionInput = {
      indicators,
      marketContext,
      orderBookImbalance,
      recentPriceMovement,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };

    console.log(`[Trading Bot] 📈 Market analysis: Imbalance=${orderBookImbalance.toFixed(4)}, Regime=${marketContext.marketRegime}`);

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    // Get adaptive thresholds
    const adaptiveThresholds = config.useAdaptiveThresholds ? 
      aiModel.current.getAdaptiveThresholds() : null;

    const dynamicConfig = getDynamicConfig(config, marketContext, adaptiveThresholds);

    console.log(`[Trading Bot] 🎯 Enhanced prediction - Prob: ${newPrediction.probability.toFixed(3)}, Conf: ${newPrediction.confidence.toFixed(3)}, Risk: ${newPrediction.riskScore.toFixed(3)}, Expected: ${newPrediction.expectedReturn.toFixed(3)}%`);
    console.log(`[Trading Bot] 🎛️ Dynamic thresholds - Prob: ${dynamicConfig.minProbability.toFixed(3)}, Conf: ${dynamicConfig.minConfidence.toFixed(3)}, Risk: ${dynamicConfig.maxRiskScore.toFixed(3)}`);

    if (shouldGenerateSignal(newPrediction, dynamicConfig)) {
      console.log(`[Trading Bot] 🎯 Signal conditions met! Creating optimized trading signal...`);
      const signal = createTradingSignal(currentPrice, newPrediction, indicators);
      if (signal) {
        console.log(`[Trading Bot] 📤 Executing ${signal.action} signal at ${signal.price.toFixed(2)} (Confidence: ${signal.confidence.toFixed(3)})`);
        setSignals(prev => [...prev.slice(-9), signal]); // Keep last 10 signals
        executeAdvancedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      } else {
        console.log(`[Trading Bot] ⏸️ Signal generated but action is HOLD, skipping execution`);
      }
    } else {
      console.log(`[Trading Bot] ❌ Signal conditions not met:`);
      console.log(`  📊 Probability: ${newPrediction.probability.toFixed(3)} (required: ${dynamicConfig.minProbability.toFixed(3)})`);
      console.log(`  🎯 Confidence: ${newPrediction.confidence.toFixed(3)} (required: ${dynamicConfig.minConfidence.toFixed(3)})`);
      console.log(`  ⚠️ Risk Score: ${newPrediction.riskScore.toFixed(3)} (max: ${dynamicConfig.maxRiskScore.toFixed(3)})`);
      console.log(`  🔢 Active Positions: ${activePositions.size} (max: ${dynamicConfig.maxPositionsPerSymbol})`);
    }
  }, [config, getDynamicConfig, activePositions, marketContext, executeAdvancedSignal]);

  const calculateOrderBookImbalance = useCallback((): number => {
    if (bids.length === 0 || asks.length === 0) return 0;
    
    const topBidsVolume = bids.slice(0, 10).reduce((sum, bid) => sum + bid.quantity, 0); // Increased depth
    const topAsksVolume = asks.slice(0, 10).reduce((sum, ask) => sum + ask.quantity, 0);
    const totalVolume = topBidsVolume + topAsksVolume;
    
    if (totalVolume === 0) return 0;
    return (topBidsVolume - topAsksVolume) / totalVolume;
  }, [bids, asks]);

  const shouldGenerateSignal = useCallback((
    prediction: PredictionOutput, 
    dynamicConfig: AdvancedTradingConfig
  ): boolean => {
    return (
      prediction.probability >= dynamicConfig.minProbability &&
      prediction.confidence >= dynamicConfig.minConfidence &&
      prediction.riskScore <= dynamicConfig.maxRiskScore &&
      activePositions.size < dynamicConfig.maxPositionsPerSymbol
    );
  }, [activePositions]);

  const generateSignalReasoning = useCallback((
    prediction: PredictionOutput,
    indicators: AdvancedIndicators
  ): string => {
    const reasons: string[] = [];
    
    // Technical analysis reasons
    if (prediction.features.technical > 0.6) {
      reasons.push('strong technical signals');
    } else if (prediction.features.technical < -0.6) {
      reasons.push('bearish technical signals');
    }
    
    if (prediction.features.momentum > 0.5) {
      reasons.push('positive momentum');
    } else if (prediction.features.momentum < -0.5) {
      reasons.push('negative momentum');
    }
    
    if (prediction.features.volatility < 0.4) {
      reasons.push('low volatility environment');
    } else if (prediction.features.volatility > 0.7) {
      reasons.push('high volatility environment');
    }
    
    // Specific indicator reasons
    if (indicators.rsi_14 < 35) {
      reasons.push('oversold RSI');
    } else if (indicators.rsi_14 > 65) {
      reasons.push('overbought RSI');
    }
    
    if (indicators.macd > indicators.macd_signal) {
      reasons.push('bullish MACD crossover');
    } else if (indicators.macd < indicators.macd_signal) {
      reasons.push('bearish MACD crossover');
    }
    
    // Market context
    if (marketContext?.marketRegime) {
      const regime = marketContext.marketRegime.replace(/_/g, ' ').toLowerCase();
      reasons.push(`${regime} market regime`);
    }
    
    // Add probability and expected return
    reasons.push(`${(prediction.probability * 100).toFixed(1)}% probability`);
    reasons.push(`${prediction.expectedReturn.toFixed(2)}% expected return`);
    
    return reasons.join(', ') || `AI prediction`;
  }, [marketContext]);

  const createTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators
  ): TradingSignal | null => {
    // Enhanced signal logic with optimized thresholds
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    // More aggressive probability thresholds for active trading
    if (prediction.probability > 0.51) { // Further lowered
      action = 'BUY';
    } else if (prediction.probability < 0.49) { // Raised
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    // Enhanced override logic for trending markets
    if (action === 'HOLD' && prediction.confidence >= 0.55) {
      const regimeBonus = marketContext?.marketRegime?.includes('BULL') ? 0.02 : 
                         marketContext?.marketRegime?.includes('BEAR') ? -0.02 : 0;
      
      if (prediction.probability + regimeBonus > 0.505) {
        action = 'BUY';
        console.log(`[Trading Bot] 🔄 Override HOLD to BUY (regime bonus: ${regimeBonus.toFixed(3)})`);
      } else if (prediction.probability + regimeBonus < 0.495) {
        action = 'SELL';
        console.log(`[Trading Bot] 🔄 Override HOLD to SELL (regime bonus: ${regimeBonus.toFixed(3)})`);
      }
    }

    if (action === 'HOLD') {
      return null;
    }

    // Define base position size in USD, e.g., using leverage on risk capital
    const basePositionSizeUSD = config.riskPerTrade * 5; // e.g. 100 * 5 = 500 USD
    const baseQuantity = basePositionSizeUSD / price;
    
    // Enhanced adaptive position sizing
    let quantity = baseQuantity;
    if (config.adaptiveSizing) {
      const kellyFraction = (prediction.probability * 2 - 1) * prediction.confidence;
      const confidenceMultiplier = Math.min(prediction.confidence * 1.5, 1.2);
      quantity = baseQuantity * (1 + kellyFraction * 0.8) * confidenceMultiplier;
    }

    // Ensure position size does not exceed max configured size
    const maxQuantityFromConfig = config.maxPositionSize / price;
    quantity = Math.min(quantity, maxQuantityFromConfig);

    // Ensure position value does not exceed available balance, with a small buffer
    const positionValue = quantity * price;
    if (positionValue > portfolio.availableBalance) {
      quantity = (portfolio.availableBalance / price) * 0.98; // Use 98% of what's available
      console.warn(`[Trading Bot] ⚠️ Position size adjusted to fit available balance. New quantity: ${quantity}`);
    }

    return {
      symbol,
      action,
      confidence: prediction.confidence,
      price,
      quantity,
      timestamp: Date.now(),
      reasoning: generateSignalReasoning(prediction, indicators)
    };
  }, [symbol, config, marketContext, portfolio.availableBalance, generateSignalReasoning]);

  const checkExitConditions = useCallback((currentPrice: number) => {
    const now = Date.now();
    
    activePositions.forEach((data, positionId) => {
      const { position, prediction, entryTime } = data;
      const holdingTime = (now - entryTime) / 1000;
      const priceChange = position.side === 'BUY' 
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;

      let shouldExit = false;
      let exitReason = '';

      // Enhanced time-based exit with dynamic adjustment
      const maxHoldTime = Math.min(prediction.timeHorizon, 150); // Reduced max hold time
      if (holdingTime >= maxHoldTime) {
        shouldExit = true;
        exitReason = 'Time limit reached';
      }

      // Dynamic profit target based on expected return
      const profitTarget = Math.max(prediction.expectedReturn / 100, 0.003); // Min 0.3%
      if (priceChange >= profitTarget) {
        shouldExit = true;
        exitReason = 'Profit target achieved';
      }

      // Enhanced stop loss with confidence adjustment
      const baseStopLoss = config.stopLossPercentage / 100;
      const confidenceAdjustment = (1 - prediction.confidence) * 0.5; // Tighter stops for low confidence
      const stopLoss = -(baseStopLoss + confidenceAdjustment);
      if (priceChange <= stopLoss) {
        shouldExit = true;
        exitReason = 'Stop loss triggered';
      }

      // Quick exit on adverse moves exceeding risk tolerance
      const riskBasedExit = -prediction.riskScore * 0.02; // Max 2% loss for high risk
      if (priceChange <= riskBasedExit) {
        shouldExit = true;
        exitReason = 'Risk-based exit';
      }

      // Emergency exits
      if (holdingTime > 200 || Math.abs(priceChange) > 0.025) { // 3.3 minutes or 2.5% move
        shouldExit = true;
        exitReason = 'Emergency exit';
      }

      if (shouldExit) {
        console.log(`[Trading Bot] 🚪 Closing position ${positionId}: ${exitReason}`);
        console.log(`[Trading Bot] 📊 Performance: ${(priceChange * 100).toFixed(2)}% return, ${holdingTime.toFixed(0)}s hold time`);
        exitPosition(positionId, currentPrice, priceChange, exitReason);
      }
    });
  }, [activePositions, config]);

  const exitPosition = useCallback((
    positionId: string,
    exitPrice: number,
    actualReturn: number,
    reason: string
  ) => {
    const positionData = activePositions.get(positionId);
    if (!positionData) return;

    closePosition(positionId, exitPrice);

    // Enhanced learning with detailed outcome tracking
    if (config.learningEnabled) {
      const outcome: TradeOutcome = {
        entryPrice: positionData.position.entryPrice,
        exitPrice,
        profitLoss: actualReturn * positionData.position.entryPrice * positionData.position.size,
        holdingTime: (Date.now() - positionData.entryTime) / 1000,
        prediction: positionData.prediction,
        actualReturn: actualReturn * 100,
        success: actualReturn > 0
      };

      aiModel.current.updateModel(outcome);
      console.log(`[Trading Bot] 🎓 Position closed with learning: ${reason}`);
      console.log(`[Trading Bot] 📈 Return: ${(actualReturn * 100).toFixed(2)}%, Expected: ${positionData.prediction.expectedReturn.toFixed(2)}%`);
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
    console.log(`[Trading Bot] 🔧 Configuration updated:`, newConfig);
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
    // Add these for backward compatibility
    signals,
    latestSignal: signals.length > 0 ? signals[signals.length - 1] : null,
    basicIndicators,
  };
};
