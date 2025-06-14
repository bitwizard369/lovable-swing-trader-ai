import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position } from '@/types/trading';

interface AdvancedTradingConfig {
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
  asks: any[],
  onAddPosition: (position: any) => string,
  onClosePosition: (id: string, price: number) => void
) => {
  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.65,
    minConfidence: 0.6,
    maxRiskScore: 0.7,
    adaptiveSizing: true,
    learningEnabled: true,
    maxPositionsPerSymbol: 3
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

  // Update technical analysis with new price data
  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      const volume = bids[0].quantity + asks[0].quantity;
      
      technicalAnalysis.current.updatePriceData(midPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      setIndicators(newIndicators);
      setMarketContext(newMarketContext);
      
      // Generate predictions and signals
      if (newIndicators && newMarketContext) {
        generateAdvancedSignal(midPrice, newIndicators, newMarketContext);
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

  const generateAdvancedSignal = useCallback((
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    // Rate limiting - minimum 10 seconds between signals
    const now = Date.now();
    if (now - lastSignalTime.current < 10000) return;

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

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    // Generate signal if conditions are met
    if (shouldGenerateSignal(newPrediction)) {
      const signal = createTradingSignal(currentPrice, newPrediction, indicators);
      if (signal) { // Only execute if we have a valid trading signal (not HOLD)
        executeAdvancedSignal(signal, newPrediction);
        lastSignalTime.current = now;
      }
    }
  }, [config]);

  const calculateOrderBookImbalance = useCallback((): number => {
    if (bids.length === 0 || asks.length === 0) return 0;
    
    const topBidsVolume = bids.slice(0, 5).reduce((sum, bid) => sum + bid.quantity, 0);
    const topAsksVolume = asks.slice(0, 5).reduce((sum, ask) => sum + ask.quantity, 0);
    const totalVolume = topBidsVolume + topAsksVolume;
    
    if (totalVolume === 0) return 0;
    return (topBidsVolume - topAsksVolume) / totalVolume;
  }, [bids, asks]);

  const shouldGenerateSignal = useCallback((prediction: PredictionOutput): boolean => {
    return (
      prediction.probability >= config.minProbability &&
      prediction.confidence >= config.minConfidence &&
      prediction.riskScore <= config.maxRiskScore &&
      activePositions.size < config.maxPositionsPerSymbol
    );
  }, [config, activePositions]);

  const createTradingSignal = useCallback((
    price: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators
  ): TradingSignal | null => {
    // Determine action based on prediction probability
    // Only return a signal if we want to BUY or SELL, not HOLD
    let action: 'BUY' | 'SELL' | 'HOLD';
    
    if (prediction.probability > 0.6) {
      action = 'BUY';
    } else if (prediction.probability < 0.4) {
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    // If action is HOLD, don't create a trading signal
    if (action === 'HOLD') {
      return null;
    }

    const baseQuantity = 0.01;
    
    // Adaptive position sizing based on confidence and Kelly criterion
    let quantity = baseQuantity;
    if (config.adaptiveSizing) {
      const kellyFraction = (prediction.probability * 2 - 1) * prediction.confidence;
      quantity = baseQuantity * (1 + kellyFraction);
    }

    return {
      symbol,
      action, // This will now only be 'BUY' or 'SELL'
      confidence: prediction.confidence,
      price,
      quantity,
      timestamp: Date.now(),
      reasoning: generateSignalReasoning(prediction, indicators)
    };
  }, [symbol, config]);

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
    if (marketContext?.trendDirection !== 'SIDEWAYS') {
      reasons.push(`${marketContext?.trendDirection.toLowerCase()} trend`);
    }
    
    return reasons.join(', ') || 'AI model prediction';
  }, [marketContext]);

  const executeAdvancedSignal = useCallback((
    signal: TradingSignal,
    prediction: PredictionOutput
  ) => {
    const positionId = onAddPosition({
      symbol: signal.symbol,
      side: signal.action, // Now guaranteed to be 'BUY' or 'SELL'
      size: signal.quantity,
      entryPrice: signal.price,
      currentPrice: signal.price,
      timestamp: signal.timestamp
    });

    if (positionId) {
      setActivePositions(prev => new Map(prev.set(positionId, {
        position: {
          id: positionId,
          symbol: signal.symbol,
          side: signal.action as 'BUY' | 'SELL', // Type assertion since we know it's not HOLD
          size: signal.quantity,
          entryPrice: signal.price,
          currentPrice: signal.price,
          unrealizedPnL: 0,
          realizedPnL: 0,
          timestamp: signal.timestamp,
          status: 'OPEN' as const
        },
        prediction,
        entryTime: Date.now()
      })));

      console.log(`Advanced signal executed: ${signal.action} ${signal.symbol} at ${signal.price} (Probability: ${prediction.probability.toFixed(2)})`);
    }
  }, [onAddPosition]);

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

      // Time-based exit
      if (holdingTime >= prediction.timeHorizon) {
        shouldExit = true;
        exitReason = 'Time horizon reached';
      }

      // Profit target (dynamic based on expected return)
      const profitTarget = Math.abs(prediction.expectedReturn) / 100;
      if (priceChange >= profitTarget) {
        shouldExit = true;
        exitReason = 'Profit target hit';
      }

      // Stop loss (adaptive based on risk score)
      const stopLoss = -prediction.riskScore * 0.02; // Max 2% loss
      if (priceChange <= stopLoss) {
        shouldExit = true;
        exitReason = 'Stop loss triggered';
      }

      // Emergency exit on extreme conditions
      if (holdingTime > 300 || Math.abs(priceChange) > 0.05) { // 5 minutes or 5% move
        shouldExit = true;
        exitReason = 'Emergency exit';
      }

      if (shouldExit) {
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

    onClosePosition(positionId, exitPrice);

    // Create trade outcome for learning
    if (config.learningEnabled) {
      const outcome: TradeOutcome = {
        entryPrice: positionData.position.entryPrice,
        exitPrice,
        profitLoss: actualReturn * positionData.position.entryPrice * positionData.position.size,
        holdingTime: (Date.now() - positionData.entryTime) / 1000,
        prediction: positionData.prediction,
        actualReturn: actualReturn * 100, // Convert to percentage
        success: actualReturn > 0
      };

      aiModel.current.updateModel(outcome);
      console.log(`Position closed: ${reason}, Return: ${(actualReturn * 100).toFixed(2)}%`);
    }

    setActivePositions(prev => {
      const updated = new Map(prev);
      updated.delete(positionId);
      return updated;
    });
  }, [activePositions, onClosePosition, config.learningEnabled]);

  const getModelPerformance = useCallback(() => {
    return aiModel.current.getModelPerformance();
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AdvancedTradingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  return {
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
