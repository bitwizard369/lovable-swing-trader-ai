
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position, Portfolio, TradingConfig as BaseTradingConfig } from '@/types/trading';

const initialPortfolio: Portfolio = {
  totalBalance: 10000,
  availableBalance: 10000,
  positions: [],
  totalPnL: 0,
  dayPnL: 0,
  equity: 10000
};

interface AdvancedTradingConfig extends BaseTradingConfig {
  minProbability: number;
  minConfidence: number;
  maxRiskScore: number;
  adaptiveSizing: boolean;
  learningEnabled: boolean;
  maxPositionsPerSymbol: number;
}

export const useAdvancedTradingSystem = (
  symbol: string,
  bids: any[],
  asks: any[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);

  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.55,
    minConfidence: 0.50,
    maxRiskScore: 0.8,
    adaptiveSizing: true,
    learningEnabled: true,
    maxPositionsPerSymbol: 100, // Updated as requested
    maxPositionSize: 1000,
    maxDailyLoss: 500,
    stopLossPercentage: 2,
    takeProfitPercentage: 4,
    maxOpenPositions: 100, // Updated as requested
    riskPerTrade: 100
  });

  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, {
    position: Position;
    prediction: PredictionOutput;
    entryTime: number;
  }>>(new Map());

  const technicalAnalysis = useRef(new AdvancedTechnicalAnalysis());
  const aiModel = useRef(new AIPredictionModel());
  const lastSignalTime = useRef(0);

  const canOpenPosition = useCallback((positionValue: number): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN').length;
    
    return (
      portfolio.availableBalance >= positionValue &&
      openPositions < config.maxOpenPositions &&
      positionValue <= config.maxPositionSize &&
      Math.abs(portfolio.dayPnL) < config.maxDailyLoss
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

      return {
        ...prev,
        positions: prev.positions.map(p =>
          p.id === positionId
            ? { ...p, status: 'CLOSED' as const, realizedPnL, currentPrice: closePrice }
            : p
        ),
        availableBalance: prev.availableBalance + positionValueAtClose,
        totalPnL: prev.totalPnL + realizedPnL,
        dayPnL: prev.dayPnL + realizedPnL,
      };
    });
  }, []);

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
            equity: prev.totalBalance + prev.totalPnL + totalUnrealizedPnL
        };
    });
  }, [symbol]);

  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      updatePositionPrices(currentPrice);
    }
  }, [bids, asks, updatePositionPrices]);

  // Update technical analysis with new price data
  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      const volume = bids[0].quantity + asks[0].quantity;
      
      console.log(`[Trading Bot] Price update: ${midPrice.toFixed(2)}, Volume: ${volume.toFixed(4)}`);
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      console.log(`[Trading Bot] Indicators available: ${!!newIndicators}, Market context: ${newMarketContext?.marketRegime}`);
      
      setIndicators(newIndicators);
      setMarketContext(newMarketContext);
      
      // Generate predictions and signals
      if (newIndicators && newMarketContext) {
        console.log(`[Trading Bot] Generating signal for price ${midPrice.toFixed(2)}`);
        generateAdvancedSignal(midPrice, newIndicators, newMarketContext);
      } else {
        console.log(`[Trading Bot] Insufficient data - Price history length: ${technicalAnalysis.current.getPriceHistoryLength()}`);
      }
    }
  }, [bids, asks]);

  // Monitor active positions for exit conditions
  useEffect(() => {
    if (activePositions.size > 0 && bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      checkExitConditions(currentPrice);
    }
  }, [bids, asks, activePositions]);

  const getDynamicConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null
  ): AdvancedTradingConfig => {
    if (!marketContext) return baseConfig;

    let probabilityAdjustment = 0;
    let confidenceAdjustment = 0;
    let riskAdjustment = 0;

    switch (marketContext.marketRegime) {
        case 'STRONG_BULL':
        case 'STRONG_BEAR':
            probabilityAdjustment = -0.03; // Lower threshold in strong trends
            confidenceAdjustment = -0.05;
            riskAdjustment = 0.05; // Allow slightly more risk
            break;
        case 'WEAK_BULL':
        case 'WEAK_BEAR':
            probabilityAdjustment = -0.01;
            break;
        case 'SIDEWAYS_VOLATILE':
            probabilityAdjustment = 0.05; // Be more selective
            confidenceAdjustment = 0.1;
            riskAdjustment = -0.1; // Be more risk-averse
            break;
        case 'SIDEWAYS_QUIET':
            probabilityAdjustment = 0.03;
            confidenceAdjustment = 0.05;
            riskAdjustment = -0.05;
            break;
    }
    
    return {
        ...baseConfig,
        minProbability: Math.max(0.51, baseConfig.minProbability + probabilityAdjustment),
        minConfidence: Math.max(0.40, baseConfig.minConfidence + confidenceAdjustment),
        maxRiskScore: Math.min(0.9, baseConfig.maxRiskScore + riskAdjustment)
    };
  }, []);

  const executeAdvancedSignal = useCallback((
    signal: TradingSignal,
    prediction: PredictionOutput
  ) => {
    if (signal.action === 'HOLD') {
      console.warn(`[Trading Bot] ⚠️ Attempted to execute a 'HOLD' signal. This should not happen.`);
      return;
    }

    console.log(`[Trading Bot] Executing signal: ${signal.action} ${signal.quantity} ${signal.symbol} at ${signal.price}`);
    
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

      console.log(`[Trading Bot] ✅ Position opened: ${signal.action} ${signal.symbol} at ${signal.price.toFixed(2)} (ID: ${newPosition.id})`);
      console.log(`[Trading Bot] Position details - Probability: ${prediction.probability.toFixed(3)}, Confidence: ${prediction.confidence.toFixed(3)}, Expected return: ${prediction.expectedReturn.toFixed(2)}%`);
    }
  }, [addPosition]);

  const generateAdvancedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    // Rate limiting - reduced to 5 seconds from 10 seconds
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    console.log(`[Trading Bot] Time since last signal: ${timeSinceLastSignal}ms (cooldown: 5000ms)`);
    
    if (timeSinceLastSignal < 5000) {
      console.log(`[Trading Bot] Rate limiting active, ${5000 - timeSinceLastSignal}ms remaining`);
      return;
    }

    const orderBookImbalance = calculateOrderBookImbalance();
    const recentPriceMovement = [currentPrice]; // Simplified - would use actual price history
    
    const predictionInput = {
      indicators,
      marketContext,
      orderBookImbalance,
      recentPriceMovement,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay()
    };

    console.log(`[Trading Bot] Order book imbalance: ${orderBookImbalance.toFixed(4)}`);

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    const dynamicConfig = getDynamicConfig(config, marketContext);

    console.log(`[Trading Bot] Prediction - Probability: ${newPrediction.probability.toFixed(3)}, Confidence: ${newPrediction.confidence.toFixed(3)}, Risk: ${newPrediction.riskScore.toFixed(3)}`);
    console.log(`[Trading Bot] Dynamic thresholds - Min Prob: ${dynamicConfig.minProbability.toFixed(2)}, Min Conf: ${dynamicConfig.minConfidence.toFixed(2)}, Max Risk: ${dynamicConfig.maxRiskScore.toFixed(2)}`);

    // Generate signal if conditions are met
    if (shouldGenerateSignal(newPrediction, dynamicConfig)) {
      console.log(`[Trading Bot] Signal conditions met! Creating trading signal...`);
      const signal = createTradingSignal(currentPrice, newPrediction, indicators);
      if (signal) {
        console.log(`[Trading Bot] Executing ${signal.action} signal at ${signal.price.toFixed(2)}`);
        executeAdvancedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      } else {
        console.log(`[Trading Bot] Signal created but was HOLD action, skipping execution`);
      }
    } else {
      console.log(`[Trading Bot] Signal conditions not met:`);
      console.log(`  - Probability: ${newPrediction.probability.toFixed(3)} (min: ${dynamicConfig.minProbability})`);
      console.log(`  - Confidence: ${newPrediction.confidence.toFixed(3)} (min: ${dynamicConfig.minConfidence})`);
      console.log(`  - Risk Score: ${newPrediction.riskScore.toFixed(3)} (max: ${dynamicConfig.maxRiskScore})`);
      console.log(`  - Active Positions: ${activePositions.size} (max: ${dynamicConfig.maxPositionsPerSymbol})`);
    }
  }, [config, getDynamicConfig, activePositions, marketContext, executeAdvancedSignal]);

  const calculateOrderBookImbalance = useCallback((): number => {
    if (bids.length === 0 || asks.length === 0) return 0;
    
    const topBidsVolume = bids.slice(0, 5).reduce((sum, bid) => sum + bid.quantity, 0);
    const topAsksVolume = asks.slice(0, 5).reduce((sum, ask) => sum + ask.quantity, 0);
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

  const createTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators
  ): TradingSignal | null => {
    // Enhanced signal logic with more aggressive thresholds
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    // More aggressive probability thresholds
    if (prediction.probability > 0.52) { // Lowered from 0.55
      action = 'BUY';
    } else if (prediction.probability < 0.48) { // Raised from 0.45
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    // Override HOLD decision in trending markets with good confidence
    if (action === 'HOLD' && prediction.confidence >= 0.6) { // Changed from > 0.6
      if ((marketContext?.marketRegime === 'STRONG_BULL' || marketContext?.marketRegime === 'WEAK_BULL') && prediction.probability > 0.51) { // Adjusted from 0.52
        action = 'BUY';
        console.log(`[Trading Bot] Overriding HOLD to BUY due to bullish regime and marginal probability`);
      } else if ((marketContext?.marketRegime === 'STRONG_BEAR' || marketContext?.marketRegime === 'WEAK_BEAR') && prediction.probability < 0.49) { // Adjusted from 0.48
        action = 'SELL';
        console.log(`[Trading Bot] Overriding HOLD to SELL due to bearish regime and marginal probability`);
      }
    }

    // If action is still HOLD, don't create a trading signal
    if (action === 'HOLD') {
      return null;
    }

    const baseQuantity = 0.01;
    
    // Adaptive position sizing based on confidence and Kelly criterion
    let quantity = baseQuantity;
    if (config.adaptiveSizing) {
      const kellyFraction = (prediction.probability * 2 - 1) * prediction.confidence;
      quantity = baseQuantity * (1 + kellyFraction * 0.5); // Reduced multiplier for safety
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
  }, [symbol, config, marketContext]);

  const generateSignalReasoning = useCallback((
    prediction: PredictionOutput,
    indicators: AdvancedIndicators
  ): string => {
    const reasons: string[] = [];
    
    if (prediction.features.technical > 0.7) {
      reasons.push('Strong technical indicators');
    }
    if (prediction.features.momentum > 0.6) {
      reasons.push('Positive momentum');
    }
    if (prediction.features.volatility < 0.4) {
      reasons.push('Low volatility environment');
    }
    
    // Add more specific reasons
    if (indicators.rsi_14 < 35) {
      reasons.push('oversold RSI');
    } else if (indicators.rsi_14 > 65) {
      reasons.push('overbought RSI');
    }
    
    if (indicators.macd > indicators.macd_signal) {
      reasons.push('bullish MACD');
    } else if (indicators.macd < indicators.macd_signal) {
      reasons.push('bearish MACD');
    }
    
    if (marketContext?.marketRegime) {
      reasons.push(`Market regime: ${marketContext.marketRegime.replace(/_/g, ' ').toLowerCase()}`);
    }
    
    return reasons.join(', ') || `AI prediction (${(prediction.probability * 100).toFixed(1)}% probability)`;
  }, [marketContext]);

  const checkExitConditions = useCallback((currentPrice: number) => {
    const now = Date.now();
    
    activePositions.forEach((data, positionId) => {
      const { position, prediction, entryTime } = data;
      const holdingTime = (now - entryTime) / 1000; // in seconds
      const priceChange = position.side === 'BUY' 
        ? (currentPrice - position.entryPrice) / position.entryPrice
        : (position.entryPrice - currentPrice) / position.entryPrice;

      let shouldExit = false;
      let exitReason = '';

      // More aggressive time-based exit - reduced from prediction.timeHorizon
      const maxHoldTime = Math.min(prediction.timeHorizon, 180); // Max 3 minutes
      if (holdingTime >= maxHoldTime) {
        shouldExit = true;
        exitReason = 'Time horizon reached';
      }

      // Profit target (dynamic based on expected return)
      const profitTarget = Math.max(Math.abs(prediction.expectedReturn) / 100, 0.005); // Min 0.5% profit
      if (priceChange >= profitTarget) {
        shouldExit = true;
        exitReason = 'Profit target hit';
      }

      // Stop loss (adaptive based on risk score)
      const stopLoss = -Math.max(prediction.riskScore * 0.015, 0.003); // Min 0.3% max loss
      if (priceChange <= stopLoss) {
        shouldExit = true;
        exitReason = 'Stop loss triggered';
      }

      // Emergency exit on extreme conditions or long holds
      if (holdingTime > 240 || Math.abs(priceChange) > 0.03) { // 4 minutes or 3% move
        shouldExit = true;
        exitReason = 'Emergency exit';
      }

      if (shouldExit) {
        console.log(`[Trading Bot] Closing position ${positionId}: ${exitReason} (Return: ${(priceChange * 100).toFixed(2)}%, Hold time: ${holdingTime.toFixed(0)}s)`);
        exitPosition(positionId, currentPrice, priceChange, exitReason);
      }
    });
  }, [activePositions]);

  const exitPosition = useCallback((
    positionId: string,
    exitPrice: number,
    actualReturn: number,
    reason: string
  ) => {
    const positionData = activePositions.get(positionId);
    if (!positionData) return;

    closePosition(positionId, exitPrice);

    // Create trade outcome for learning
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
      console.log(`[Trading Bot] ✅ Position closed: ${reason}, Return: ${(actualReturn * 100).toFixed(2)}%, Learning updated`);
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
    console.log(`[Trading Bot] Config updated:`, newConfig);
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
    aiModel: aiModel.current
  };
};
