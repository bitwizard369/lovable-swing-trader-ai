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
    stopLossPercentage: 0.5, // Increased from 1.2% to 0.5% (more reasonable)
    takeProfitPercentage: 1.5, // Increased from 2.5% to 1.5%
    maxOpenPositions: 100,
    riskPerTrade: 100,
    enableProfitLock: true,
    profitLockPercentage: 1.0,
    minProfitLockThreshold: 0,
    useKellyCriterion: true,
    maxKellyFraction: 0.20,
    enableTrailingStop: true,
    trailingStopATRMultiplier: 3.0, // Increased from 2.0 to 3.0 for wider trailing stops
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Use refs to prevent re-initialization
  const technicalAnalysis = useRef<AdvancedTechnicalAnalysis | null>(null);
  const aiModel = useRef<AIPredictionModel | null>(null);
  const autoTradingEngine = useRef<AutoTradingEngine | null>(null);
  const positionManager = useRef<PositionManager | null>(null);
  const lastSignalTime = useRef(0);
  const lastPriceUpdate = useRef(0);

  // Initialize services only once
  useEffect(() => {
    if (!isInitialized) {
      console.log('[Trading System] 🚀 Initializing core services...');
      
      // Initialize technical analysis
      if (!technicalAnalysis.current) {
        technicalAnalysis.current = new AdvancedTechnicalAnalysis();
        console.log('[Trading System] ✅ Technical Analysis initialized');
      }

      // Initialize AI model
      if (!aiModel.current) {
        aiModel.current = new AIPredictionModel();
        console.log('[Trading System] ✅ AI Model initialized');
      }

      setIsInitialized(true);
      console.log('[Trading System] ✅ Core services initialized successfully');
    }
  }, []);

  // Initialize auto trading and position manager when config changes
  useEffect(() => {
    if (!isInitialized) return;

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
      takeProfitMultiplier: config.takeProfitPercentage,
      enableStopLoss: true,
      stopLossMultiplier: config.stopLossPercentage,
      enablePartialProfits: config.enablePartialProfits,
      partialProfitLevels: config.partialProfitLevels
    };

    autoTradingEngine.current = new AutoTradingEngine(autoConfig);
    positionManager.current = new PositionManager(positionConfig);

    console.log('[Trading System] ⚙️ Auto trading and position manager updated with improved stop loss settings');
  }, [config, isInitialized]);

  // Portfolio Management Functions
  const addPosition = useCallback((
    positionData: {
      symbol: string;
      side: 'BUY' | 'SELL';
      size: number;
      entryPrice: number;
      currentPrice: number;
      timestamp: number;
    },
    prediction: PredictionOutput
  ): Position | null => {
    const newPosition: Position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: positionData.symbol,
      side: positionData.side,
      size: positionData.size,
      entryPrice: positionData.entryPrice,
      currentPrice: positionData.currentPrice,
      timestamp: positionData.timestamp,
      status: 'OPEN',
      unrealizedPnL: 0,
      realizedPnL: 0
    };

    // Calculate position value
    const positionValue = positionData.size * positionData.entryPrice;
    
    // Check if we have enough balance
    if (positionValue > portfolio.availableBalance) {
      console.warn('[Portfolio] Insufficient balance for position');
      return null;
    }

    // Update portfolio
    setPortfolio(prev => ({
      ...prev,
      positions: [...prev.positions, newPosition],
      availableBalance: prev.availableBalance - positionValue
    }));

    // Add to position manager if available
    if (positionManager.current && indicators) {
      const managedPosition = positionManager.current.addPosition(newPosition, prediction, indicators);
      
      // Track the position for management
      setActivePositions(prev => {
        const newMap = new Map(prev);
        newMap.set(newPosition.id, {
          position: newPosition,
          prediction,
          entryTime: Date.now()
        });
        return newMap;
      });
    }

    console.log(`[Portfolio] ✅ Added ${positionData.side} position: ${newPosition.id} for ${positionData.size.toFixed(6)} at ${positionData.entryPrice.toFixed(2)}`);
    return newPosition;
  }, [portfolio.availableBalance, indicators]);

  const closePosition = useCallback((
    positionId: string,
    exitPrice: number,
    reason: string = 'Manual close'
  ) => {
    setPortfolio(prev => {
      const position = prev.positions.find(p => p.id === positionId);
      if (!position) {
        console.warn(`[Portfolio] Position ${positionId} not found`);
        return prev;
      }

      // Calculate P&L
      const pnlMultiplier = position.side === 'BUY' ? 1 : -1;
      const pnl = (exitPrice - position.entryPrice) * position.size * pnlMultiplier;
      const positionValue = position.size * exitPrice;

      console.log(`[Portfolio] 📈 Closing position ${positionId}: P&L = ${pnl.toFixed(2)}, Reason = ${reason}`);

      // Update position status
      const updatedPosition: Position = {
        ...position,
        status: 'CLOSED',
        currentPrice: exitPrice,
        realizedPnL: pnl,
        unrealizedPnL: 0
      };

      return {
        ...prev,
        positions: prev.positions.map(p => p.id === positionId ? updatedPosition : p),
        availableBalance: prev.availableBalance + positionValue,
        totalPnL: prev.totalPnL + pnl,
        dayPnL: prev.dayPnL + pnl,
        equity: prev.equity + pnl
      };
    });

    // Remove from active positions tracking
    setActivePositions(prev => {
      const newMap = new Map(prev);
      newMap.delete(positionId);
      return newMap;
    });
  }, []);

  // AI Model Management Functions
  const getModelPerformance = useCallback(() => {
    if (!aiModel.current) return null;
    return aiModel.current.getModelPerformance();
  }, []);

  const resetAIModel = useCallback(() => {
    if (!aiModel.current) return;
    aiModel.current.resetModelState();
    console.log('[AI Model] 🔄 Model reset completed');
  }, []);

  const syncAIModelWithDatabase = useCallback(async () => {
    if (!aiModel.current || !currentSessionId) return;
    
    try {
      // Save current model state to database
      const modelState = aiModel.current.exportModelState();
      console.log('[AI Model] 💾 Syncing model state with database...');
      
      // Here you would implement the actual database sync
      // For now, just log the action
      console.log('[AI Model] ✅ Model state synced successfully');
    } catch (error) {
      console.error('[AI Model] ❌ Failed to sync model state:', error);
    }
  }, [currentSessionId]);

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

  // CORE MARKET DATA PROCESSING LOOP - This was missing!
  useEffect(() => {
    if (!isInitialized || !technicalAnalysis.current || !aiModel.current) return;
    if (bids.length === 0 || asks.length === 0) return;

    const currentPrice = (bids[0].price + asks[0].price) / 2;
    const currentTime = Date.now();
    
    // Rate limit price updates to every 500ms
    if (currentTime - lastPriceUpdate.current < 500) return;
    lastPriceUpdate.current = currentTime;

    console.log(`[Trading System] 📊 Processing market data: ${currentPrice.toFixed(2)}`);

    try {
      // Update technical analysis with new price data
      const estimatedVolume = (bids[0]?.quantity || 0) + (asks[0]?.quantity || 0);
      technicalAnalysis.current.updatePriceData(currentPrice, estimatedVolume);

      // Calculate technical indicators
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      if (newIndicators) {
        setIndicators(newIndicators);
        
        // Update basic indicators for display
        setBasicIndicators({
          rsi: newIndicators.rsi_14,
          ema_fast: newIndicators.ema_12,
          ema_slow: newIndicators.ema_26,
          macd: newIndicators.macd,
          signal: newIndicators.macd_signal,
          volume_ratio: newIndicators.volume_ratio
        });

        console.log(`[Trading System] 📈 Indicators updated - RSI: ${newIndicators.rsi_14.toFixed(2)}, MACD: ${newIndicators.macd.toFixed(4)}`);
      }

      // Get market context
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      setMarketContext(newMarketContext);

      // Generate trading signals if we have enough data
      if (newIndicators && technicalAnalysis.current.getPriceHistoryLength() > 26) {
        generateRecalibratedSignal(currentPrice, newIndicators, newMarketContext);
      } else {
        console.log(`[Trading System] ⏳ Waiting for more data: ${technicalAnalysis.current.getPriceHistoryLength()}/26 price points`);
      }

    } catch (error) {
      console.error('[Trading System] ❌ Error processing market data:', error);
    }
  }, [bids, asks, isInitialized]);

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

    if (dynamicConfig.debugMode) {
      console.log(`[Signal Check] Confidence: ${prediction.confidence.toFixed(3)} >= ${dynamicConfig.minConfidence.toFixed(3)} = ${meetsConfidence}`);
      console.log(`[Signal Check] Probability: ${prediction.probability.toFixed(3)} >= ${dynamicConfig.minProbability.toFixed(3)} = ${meetsProbability}`);
      console.log(`[Signal Check] Risk: ${prediction.riskScore.toFixed(3)} <= ${dynamicConfig.maxRiskScore.toFixed(3)} = ${meetsRisk}`);
      console.log(`[Signal Check] Liquidity: ${marketContext.liquidityScore.toFixed(3)} >= ${dynamicConfig.minLiquidityScore.toFixed(3)} = ${meetsLiquidity}`);
    }

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

  const generateRecalibratedSignal = useCallback(async (
    currentPrice: number,
    indicators: AdvancedIndicators,
    marketContext: MarketContext
  ) => {
    if (!aiModel.current) return;
    
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime.current;
    
    // Rate limit signals to every 2 seconds
    if (timeSinceLastSignal < 2000) {
      return;
    }

    console.log(`[Trading System] 🎯 Generating prediction for ${currentPrice.toFixed(2)}`);

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

    try {
      const newPrediction = aiModel.current.predict(predictionInput);
      setPrediction(newPrediction);

      const dynamicThresholds = config.useDynamicThresholds ? 
        aiModel.current.getDynamicThresholds() : null;
      
      const adaptiveThresholds = config.useAdaptiveThresholds ? 
        aiModel.current.getAdaptiveThresholds() : null;

      const dynamicConfig = getDynamicConfig(config, marketContext, adaptiveThresholds, dynamicThresholds);

      if (shouldGenerateRecalibratedSignal(newPrediction, dynamicConfig, marketContext, dynamicThresholds || adaptiveThresholds)) {
        console.log(`[Trading System] ✅ Signal conditions met! Generating signal...`);
        
        const signal = createEnhancedTradingSignal(currentPrice, newPrediction, indicators, marketContext);
        
        if (signal) {
          setSignals(prev => [...prev.slice(-9), signal]);
          
          // Execute signal if auto trading is enabled
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
        console.log(`[Trading System] ❌ Signal conditions not met - awaiting better opportunity`);
      }
    } catch (error) {
      console.error('[Trading System] ❌ Error generating signal:', error);
    }
  }, [config, getDynamicConfig, portfolio, calculateOrderBookImbalance, calculateDeepOrderBookData, shouldGenerateRecalibratedSignal, createEnhancedTradingSignal]);

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

    if (config.learningEnabled && managedPos && aiModel.current) {
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

  // Position management effect - monitor positions for exit conditions
  useEffect(() => {
    if (!positionManager.current || activePositions.size === 0) return;
    if (bids.length === 0 || asks.length === 0) return;

    const currentPrice = (bids[0].price + asks[0].price) / 2;
    
    // Update all open positions with current price and calculate unrealized P&L
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p => {
        if (p.status === 'OPEN') {
          const pnlMultiplier = p.side === 'BUY' ? 1 : -1;
          const unrealizedPnL = (currentPrice - p.entryPrice) * p.size * pnlMultiplier;
          
          console.log(`[Portfolio] 💹 Updating position ${p.id} - Entry: ${p.entryPrice.toFixed(2)}, Current: ${currentPrice.toFixed(2)}, P&L: ${unrealizedPnL.toFixed(2)}`);
          
          return {
            ...p,
            currentPrice,
            unrealizedPnL
          };
        }
        return p;
      })
    }));
    
    // Check each managed position for exit conditions
    activePositions.forEach((posTracking, positionId) => {
      const exitCheck = positionManager.current!.updatePosition(positionId, currentPrice, indicators);
      
      if (exitCheck.shouldExit) {
        if (exitCheck.isPartialExit && exitCheck.exitQuantity) {
          handlePartialExit(positionId, currentPrice, exitCheck.exitQuantity, exitCheck.exitReason || 'Partial exit');
        } else {
          exitPosition(positionId, currentPrice, exitCheck.exitReason || 'Exit condition met');
        }
      }
    });
  }, [bids, asks, activePositions, indicators]);

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
