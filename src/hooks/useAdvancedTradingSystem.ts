
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionOutput, TradeOutcome } from '@/services/aiPredictionModel';
import { TradingSignal, Position, Portfolio, TradingConfig as BaseTradingConfig } from '@/types/trading';
import { AutoTradingEngine, AutoTradingConfig } from '@/services/autoTradingEngine';
import { PositionManager, PositionManagerConfig, ManagedPosition } from '@/services/positionManager';
import { supabase } from '@/integrations/supabase/client';

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

interface PositionTracking {
  position: Position;
  prediction: PredictionOutput;
  entryTime: number;
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
  autoTradingEnabled: boolean;
  autoTradingDryRun: boolean;
  confirmBeforeExecution: boolean;
}

const convertToPredictionOutput = (data: any): PredictionOutput | null => {
  if (!data || typeof data !== 'object') return null;
  
  if (
    typeof data.probability === 'number' &&
    typeof data.confidence === 'number' &&
    typeof data.expectedReturn === 'number' &&
    typeof data.timeHorizon === 'number'
  ) {
    return {
      probability: data.probability,
      confidence: data.confidence,
      expectedReturn: data.expectedReturn,
      timeHorizon: data.timeHorizon,
      riskScore: data.riskScore || 0,
      kellyFraction: data.kellyFraction || 0,
      maxAdverseExcursion: data.maxAdverseExcursion || 0,
      features: data.features || { technical: 0, momentum: 0, volume: 0, orderbook: 0 },
      featureContributions: data.featureContributions || null
    };
  }
  
  return null;
};

export const useAdvancedTradingSystem = (
  symbol: string,
  bids: any[],
  asks: any[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<AdvancedTradingConfig>({
    minProbability: 0.48,
    minConfidence: 0.30,
    maxRiskScore: 0.80,
    adaptiveSizing: true,
    learningEnabled: true,
    useAdaptiveThresholds: true,
    useDynamicThresholds: true,
    enableOpportunityDetection: true,
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
    maxKellyFraction: 0.20,
    enableTrailingStop: true,
    trailingStopATRMultiplier: 2.0,
    enablePartialProfits: true,
    partialProfitLevels: [0.8, 1.5, 2.2],
    debugMode: true,
    minLiquidityScore: 0.02,
    minSpreadQuality: 0.05,
    autoTradingEnabled: true,
    autoTradingDryRun: false,
    confirmBeforeExecution: false
  });

  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionOutput | null>(null);
  const [activePositions, setActivePositions] = useState<Map<string, PositionTracking>>(new Map());
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [basicIndicators, setBasicIndicators] = useState<BasicTechnicalIndicators | null>(null);

  const technicalAnalysis = useRef(new AdvancedTechnicalAnalysis());
  const aiModel = useRef(new AIPredictionModel());
  const autoTradingEngine = useRef<AutoTradingEngine | null>(null);
  const positionManager = useRef<PositionManager | null>(null);
  const lastSignalTime = useRef(0);

  // Utility functions
  const calculateOrderBookImbalance = useCallback(() => {
    if (bids.length === 0 || asks.length === 0) return 0;
    const bidVolume = bids.slice(0, 5).reduce((sum, bid) => sum + bid.quantity, 0);
    const askVolume = asks.slice(0, 5).reduce((sum, ask) => sum + ask.quantity, 0);
    return (bidVolume - askVolume) / (bidVolume + askVolume);
  }, [bids, asks]);

  const calculateDeepOrderBookData = useCallback(() => {
    const bidDepth = bids.slice(0, 10).map(bid => bid.quantity);
    const askDepth = asks.slice(0, 10).map(ask => ask.quantity);
    const spread = asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0;
    const weightedMidPrice = asks.length > 0 && bids.length > 0 ? (bids[0].price + asks[0].price) / 2 : 0;
    
    return {
      bidDepth,
      askDepth,
      spread,
      weightedMidPrice
    };
  }, [bids, asks]);

  const getDynamicConfig = useCallback((
    baseConfig: AdvancedTradingConfig, 
    marketContext: MarketContext | null, 
    adaptiveThresholds: any = null, 
    dynamicThresholds: any = null
  ) => {
    let adjustedConfig = { ...baseConfig };
    
    if (marketContext) {
      // Adjust thresholds based on market volatility regime
      const volatilityAdjustment = marketContext.volatilityRegime === 'HIGH' ? 0.5 : 
                                   marketContext.volatilityRegime === 'LOW' ? 0.1 : 0.3;
      const normalizedVolatility = Math.min(volatilityAdjustment / 100, 0.5);
      adjustedConfig.minConfidence = Math.max(0.2, baseConfig.minConfidence - normalizedVolatility);
      adjustedConfig.minProbability = Math.max(0.45, baseConfig.minProbability - normalizedVolatility);
    }

    // Apply adaptive or dynamic thresholds if available
    if (adaptiveThresholds) {
      adjustedConfig.minConfidence = adaptiveThresholds.confidence || adjustedConfig.minConfidence;
      adjustedConfig.minProbability = adaptiveThresholds.probability || adjustedConfig.minProbability;
    }

    if (dynamicThresholds) {
      adjustedConfig.minConfidence = dynamicThresholds.confidence || adjustedConfig.minConfidence;
      adjustedConfig.minProbability = dynamicThresholds.probability || adjustedConfig.minProbability;
    }

    return adjustedConfig;
  }, []);

  const shouldGenerateRecalibratedSignal = useCallback((
    prediction: PredictionOutput,
    dynamicConfig: AdvancedTradingConfig,
    marketContext: MarketContext | null,
    thresholds: any = null
  ) => {
    if (!prediction || !marketContext) return false;

    const meetsConfidence = prediction.confidence >= dynamicConfig.minConfidence;
    const meetsProbability = prediction.probability >= dynamicConfig.minProbability;
    const meetsRisk = prediction.riskScore <= dynamicConfig.maxRiskScore;
    const meetsLiquidity = marketContext.liquidityScore >= dynamicConfig.minLiquidityScore;

    console.log(`[Signal Check] Confidence: ${prediction.confidence.toFixed(3)} >= ${dynamicConfig.minConfidence.toFixed(3)} = ${meetsConfidence}`);
    console.log(`[Signal Check] Probability: ${prediction.probability.toFixed(3)} >= ${dynamicConfig.minProbability.toFixed(3)} = ${meetsProbability}`);
    console.log(`[Signal Check] Risk: ${prediction.riskScore.toFixed(3)} <= ${dynamicConfig.maxRiskScore.toFixed(3)} = ${meetsRisk}`);

    return meetsConfidence && meetsProbability && meetsRisk && meetsLiquidity;
  }, []);

  const createEnhancedTradingSignal = useCallback((
    currentPrice: number,
    prediction: PredictionOutput,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ): TradingSignal | null => {
    if (!prediction || !indicators || !marketContext) return null;

    const action = prediction.probability > 0.5 ? 'BUY' : 'SELL';
    const baseQuantity = config.riskPerTrade / currentPrice;
    
    // Apply Kelly Criterion if enabled
    let quantity = baseQuantity;
    if (config.useKellyCriterion && prediction.kellyFraction > 0) {
      const kellyQuantity = (portfolio.availableBalance * Math.min(prediction.kellyFraction, config.maxKellyFraction)) / currentPrice;
      quantity = Math.min(kellyQuantity, baseQuantity);
    }

    return {
      symbol,
      action: action as 'BUY' | 'SELL',
      confidence: prediction.confidence,
      price: currentPrice,
      quantity: Math.max(0.001, quantity), // Minimum quantity
      timestamp: Date.now(),
      reasoning: `${action} signal with ${(prediction.confidence * 100).toFixed(1)}% confidence based on ${prediction.expectedReturn.toFixed(2)}% expected return. Kelly fraction: ${prediction.kellyFraction.toFixed(3)}`
    };
  }, [symbol, config, portfolio.availableBalance]);

  const getModelPerformance = useCallback(() => {
    return aiModel.current.getModelPerformance();
  }, []);

  const resetAIModel = useCallback(() => {
    aiModel.current.resetModelState();
    console.log('[AI Model] Model reset to initial state');
  }, []);

  const syncAIModelWithDatabase = useCallback(async () => {
    if (!currentSessionId) return;
    
    try {
      // Sync model performance and state with database
      const performance = getModelPerformance();
      console.log('[Database Sync] Syncing AI model performance:', performance);
      
      // This would typically save the model state to Supabase
      // Implementation depends on your database schema
    } catch (error) {
      console.error('[Database Sync] Failed to sync AI model:', error);
    }
  }, [currentSessionId, getModelPerformance]);

  useEffect(() => {
    const autoConfig: AutoTradingConfig = {
      enabled: config.autoTradingEnabled,
      maxPositionsPerSymbol: config.maxPositionsPerSymbol,
      maxDailyLoss: config.maxDailyLoss,
      emergencyStopEnabled: true,
      dryRunMode: config.autoTradingDryRun,
      confirmBeforeExecution: config.confirmBeforeExecution
    };

    const positionConfig: PositionManagerConfig = {
      enableTrailingStops: config.enableTrailingStop,
      trailingStopATRMultiplier: config.trailingStopATRMultiplier,
      enableTakeProfit: true,
      takeProfitMultiplier: config.takeProfitPercentage / 100,
      enableStopLoss: true,
      stopLossMultiplier: config.stopLossPercentage / 100,
      enablePartialProfits: config.enablePartialProfits,
      partialProfitLevels: config.partialProfitLevels
    };

    autoTradingEngine.current = new AutoTradingEngine(autoConfig);
    positionManager.current = new PositionManager(positionConfig);
  }, [config]);

  const canOpenPosition = useCallback((positionValue: number): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN').length;
    
    const hasEnoughBalance = portfolio.availableBalance >= positionValue;
    const isUnderMaxPositions = openPositions < config.maxOpenPositions;
    const isUnderMaxSize = positionValue <= config.maxPositionSize;
    const isUnderMaxLoss = Math.abs(portfolio.dayPnL) < config.maxDailyLoss;

    return hasEnoughBalance && isUnderMaxPositions && isUnderMaxSize && isUnderMaxLoss;
  }, [portfolio, config]);

  const addPosition = useCallback((position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>, prediction?: PredictionOutput): Position | null => {
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

    if (prediction && positionManager.current && indicators) {
      positionManager.current.addPosition(newPosition, prediction, indicators);
    }

    console.log(`[Trading Bot] ✅ Position opened: ${newPosition.side} ${newPosition.size.toFixed(6)} ${newPosition.symbol} at ${newPosition.entryPrice.toFixed(2)}`);

    return newPosition;
  }, [canOpenPosition, indicators]);

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

      console.log(`[Trading Bot] 🚪 Position closed: ${position.symbol} P&L: ${realizedPnL.toFixed(2)} USD`);

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

  const updatePositionTracking = useCallback((currentPrice: number) => {
    if (!positionManager.current) return;

    const managedPositions = positionManager.current.getAllPositions();
    
    managedPositions.forEach((managedPos) => {
      const { position } = managedPos;
      
      if (position.symbol === symbol && position.status === 'OPEN') {
        const exitCheck = positionManager.current!.updatePosition(
          position.id, 
          currentPrice, 
          indicators || undefined
        );

        if (exitCheck.shouldExit) {
          console.log(`[Position Manager] 🚪 ${exitCheck.isPartialExit ? 'Partial' : 'Full'} exit triggered: ${exitCheck.exitReason}`);
          
          if (exitCheck.isPartialExit && exitCheck.exitQuantity) {
            handlePartialExit(position.id, currentPrice, exitCheck.exitQuantity, exitCheck.exitReason || 'Partial exit');
          } else {
            exitPosition(position.id, currentPrice, exitCheck.exitReason || 'Exit condition met');
          }
        }
      }
    });
  }, [symbol, indicators]);

  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const currentPrice = (bids[0].price + asks[0].price) / 2;
      updatePositionPrices(currentPrice);
      updatePositionTracking(currentPrice);
    }
  }, [bids, asks, updatePositionPrices, updatePositionTracking]);

  const executeAdvancedSignal = useCallback(async (
    signal: TradingSignal,
    prediction: PredictionOutput
  ): Promise<Position | null> => {
    if (signal.action === 'HOLD') {
      console.warn(`[Trading Bot] ⚠️ Attempted to execute a 'HOLD' signal.`);
      return null;
    }

    console.log(`[Trading Bot] 🚀 Executing signal: ${signal.action} ${signal.symbol}`);
    
    const newPosition = addPosition({
      symbol: signal.symbol,
      side: signal.action,
      size: signal.quantity,
      entryPrice: signal.price,
      currentPrice: signal.price,
      timestamp: signal.timestamp
    }, prediction);

    if (newPosition && autoTradingEngine.current) {
      const priceChange = 0; // New position starts at 0 P&L
      autoTradingEngine.current.updateDailyPnL(0);
      console.log(`[Trading Bot] ✅ Position opened with auto management`);
    }

    return newPosition;
  }, [addPosition]);

  const generateRecalibratedSignal = useCallback(async (
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    
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

    const newPrediction = aiModel.current.predict(predictionInput);
    setPrediction(newPrediction);

    const dynamicThresholds = config.useDynamicThresholds ? 
      aiModel.current.getDynamicThresholds() : null;
    
    const adaptiveThresholds = config.useAdaptiveThresholds ? 
      aiModel.current.getAdaptiveThresholds() : null;

    const dynamicConfig = getDynamicConfig(config, marketContext, adaptiveThresholds, dynamicThresholds);

    if (shouldGenerateRecalibratedSignal(newPrediction, dynamicConfig, marketContext, dynamicThresholds || adaptiveThresholds)) {
      console.log(`[Trading Bot] 🎯 Signal conditions met!`);
      const signal = createEnhancedTradingSignal(currentPrice, newPrediction, indicators, marketContext);
      
      if (signal) {
        setSignals(prev => [...prev.slice(-9), signal]);
        
        if (autoTradingEngine.current) {
          const canExecute = autoTradingEngine.current.canExecuteTrade(
            signal, 
            portfolio.positions, 
            portfolio.availableBalance
          );

          if (canExecute.canExecute) {
            const result = await autoTradingEngine.current.executeSignal(
              signal, 
              newPrediction, 
              executeAdvancedSignal
            );

            if (result.success) {
              console.log(`[Auto Trading] ✅ Signal executed successfully`);
            } else {
              console.error(`[Auto Trading] ❌ Failed to execute signal: ${result.error}`);
            }
          } else {
            console.log(`[Auto Trading] ⚠️ Cannot execute signal: ${canExecute.reason}`);
          }
        }
        
        lastSignalTime.current = now;
      }
    } else {
      console.log(`[Trading Bot] ❌ Signal conditions not met - awaiting better opportunity`);
    }
  }, [config, getDynamicConfig, portfolio, executeAdvancedSignal, calculateOrderBookImbalance, calculateDeepOrderBookData, shouldGenerateRecalibratedSignal, createEnhancedTradingSignal]);

  const handlePartialExit = useCallback((
    positionId: string,
    exitPrice: number,
    exitQuantity: number,
    reason: string
  ) => {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p =>
        p.id === positionId ? { ...p, size: p.size - exitQuantity } : p
      )
    }));

    console.log(`[Trading Bot] 📈 Partial exit: ${exitQuantity.toFixed(6)} at ${exitPrice.toFixed(2)} - ${reason}`);
  }, []);

  const exitPosition = useCallback((
    positionId: string,
    exitPrice: number,
    reason: string
  ) => {
    const managedPos = positionManager.current?.removePosition(positionId);
    closePosition(positionId, exitPrice);

    if (config.learningEnabled && managedPos) {
      const actualReturn = managedPos.position.side === 'BUY'
        ? (exitPrice - managedPos.position.entryPrice) / managedPos.position.entryPrice
        : (managedPos.position.entryPrice - exitPrice) / managedPos.position.entryPrice;

      const outcome: TradeOutcome = {
        entryPrice: managedPos.position.entryPrice,
        exitPrice,
        profitLoss: actualReturn * managedPos.position.entryPrice * managedPos.position.size,
        holdingTime: (Date.now() - managedPos.entryTime) / 1000,
        prediction: managedPos.prediction,
        actualReturn: actualReturn * 100,
        success: actualReturn > 0,
        maxAdverseExcursion: managedPos.maxAdverseExcursion * 100,
        maxFavorableExcursion: managedPos.maxFavorableExcursion * 100
      };

      aiModel.current.updateModel(outcome);
      
      if (autoTradingEngine.current) {
        autoTradingEngine.current.updateDailyPnL(outcome.profitLoss);
      }
      
      console.log(`[Trading Bot] 🎓 Learning from trade: Return=${actualReturn.toFixed(3)}, Reason=${reason}`);
    }
  }, [closePosition, config.learningEnabled]);

  const updateConfig = useCallback((newConfig: Partial<AdvancedTradingConfig>) => {
    console.log(`[Trading Bot] 🔧 Configuration updated:`, newConfig);
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      
      if (autoTradingEngine.current) {
        autoTradingEngine.current.updateConfig({
          enabled: updated.autoTradingEnabled,
          dryRunMode: updated.autoTradingDryRun,
          confirmBeforeExecution: updated.confirmBeforeExecution
        });
      }
      
      return updated;
    });
  }, []);

  const getAutoTradingStatus = useCallback(() => {
    return autoTradingEngine.current?.getStatus() || null;
  }, []);

  // Create a simple executeSignalManually function that matches the expected signature
  const executeSignalManually = useCallback((signal: TradingSignal) => {
    if (!prediction) {
      console.warn('[Manual Execution] No prediction available for manual signal execution');
      return;
    }
    executeAdvancedSignal(signal, prediction);
  }, [executeAdvancedSignal, prediction]);

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
    resetAIModel,
    syncAIModelWithDatabase,
    currentSessionId,
    autoTradingStatus: getAutoTradingStatus(),
    managedPositions: positionManager.current?.getAllPositions() || [],
    executeSignalManually
  };
};
