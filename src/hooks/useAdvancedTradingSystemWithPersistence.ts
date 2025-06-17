
import { useState, useEffect, useCallback, useRef } from 'react';
import { AdvancedTechnicalAnalysis, AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { AIPredictionModel, PredictionResult } from '@/services/aiPredictionModel';
import { Portfolio, Position, TradingSignal, TradingConfig } from '@/types/trading';
import { useSupabaseTradingPersistence } from './useSupabaseTradingPersistence';
import { toast } from 'sonner';

const defaultConfig: TradingConfig = {
  maxPositionSize: 0.02,
  maxDailyLoss: 0.05,
  stopLossPercentage: 0.02,
  takeProfitPercentage: 0.04,
  maxOpenPositions: 3,
  riskPerTrade: 0.01
};

const initialPortfolio: Portfolio = {
  baseCapital: 10000,
  availableBalance: 10000,
  lockedProfits: 0,
  positions: [],
  totalPnL: 0,
  dayPnL: 0,
  equity: 10000
};

export const useAdvancedTradingSystemWithPersistence = (
  symbol: string,
  bids: { price: number; quantity: number }[],
  asks: { price: number; quantity: number }[]
) => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [indicators, setIndicators] = useState<AdvancedIndicators | null>(null);
  const [marketContext, setMarketContext] = useState<MarketContext | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [config, setConfig] = useState<TradingConfig>(defaultConfig);
  const [isInitialized, setIsInitialized] = useState(false);

  const technicalAnalysis = useRef(new AdvancedTechnicalAnalysis());
  const aiModel = useRef(new AIPredictionModel());
  const lastPriceRef = useRef<number>(0);
  const snapshotIntervalRef = useRef<NodeJS.Timeout>();

  const {
    currentSession,
    isRecovering,
    isAuthenticated,
    recoveredData,
    initializeSession,
    savePortfolioState,
    savePosition,
    updatePosition,
    saveSignal,
    takePortfolioSnapshot,
    endSession
  } = useSupabaseTradingPersistence(symbol);

  // Initialize session when authenticated
  useEffect(() => {
    if (isAuthenticated && !currentSession && !isRecovering) {
      initializeSession(portfolio, config);
    }
  }, [isAuthenticated, currentSession, isRecovering, initializeSession, portfolio, config]);

  // Restore data from recovery
  useEffect(() => {
    if (recoveredData && !isInitialized) {
      console.log('[Trading System] 🔄 Restoring data from Supabase');
      setPortfolio(recoveredData.portfolio);
      setIsInitialized(true);
      toast.success(`Session recovered! Equity: $${recoveredData.portfolio.equity.toFixed(2)}`);
    }
  }, [recoveredData, isInitialized]);

  // Auto-save portfolio state
  useEffect(() => {
    if (isInitialized && currentSession) {
      savePortfolioState(portfolio);
    }
  }, [portfolio, isInitialized, currentSession, savePortfolioState]);

  // Set up periodic snapshots
  useEffect(() => {
    if (!currentSession) return;

    snapshotIntervalRef.current = setInterval(() => {
      if (indicators && marketContext) {
        takePortfolioSnapshot(portfolio, marketContext, indicators);
      }
    }, 60000); // Every minute

    return () => {
      if (snapshotIntervalRef.current) {
        clearInterval(snapshotIntervalRef.current);
      }
    };
  }, [currentSession, portfolio, indicators, marketContext, takePortfolioSnapshot]);

  // Calculate current price from order book
  const getCurrentPrice = useCallback(() => {
    if (bids.length === 0 || asks.length === 0) return lastPriceRef.current;
    
    const bestBid = Math.max(...bids.map(b => b.price));
    const bestAsk = Math.min(...asks.map(a => a.price));
    const midPrice = (bestBid + bestAsk) / 2;
    
    if (midPrice > 0) {
      lastPriceRef.current = midPrice;
    }
    
    return lastPriceRef.current;
  }, [bids, asks]);

  // Update technical analysis with new price data
  useEffect(() => {
    const currentPrice = getCurrentPrice();
    if (currentPrice > 0) {
      const volume = bids.reduce((sum, bid) => sum + bid.quantity, 0) + 
                   asks.reduce((sum, ask) => sum + ask.quantity, 0);
      
      technicalAnalysis.current.updatePriceData(currentPrice, volume);
      
      const newIndicators = technicalAnalysis.current.calculateAdvancedIndicators();
      const newMarketContext = technicalAnalysis.current.getMarketContext();
      
      setIndicators(newIndicators);
      setMarketContext(newMarketContext);
      
      if (newIndicators && newMarketContext) {
        const priceHistory = technicalAnalysis.current.getPriceHistory();
        if (priceHistory.length >= 20) {
          const newPrediction = aiModel.current.predict(newIndicators, newMarketContext, priceHistory);
          setPrediction(newPrediction);
          
          // Generate trading signal based on prediction
          if (newPrediction.confidence > 0.7) {
            generateTradingSignal(newPrediction, newIndicators, currentPrice);
          }
        }
      }
    }
  }, [bids, asks, getCurrentPrice]);

  const generateTradingSignal = useCallback(async (
    prediction: PredictionResult, 
    indicators: AdvancedIndicators, 
    currentPrice: number
  ) => {
    if (!currentSession) return;

    const signal: TradingSignal = {
      symbol,
      action: prediction.direction === 'UP' ? 'BUY' : prediction.direction === 'DOWN' ? 'SELL' : 'HOLD',
      confidence: prediction.confidence,
      price: currentPrice,
      quantity: Math.min(config.maxPositionSize * portfolio.availableBalance / currentPrice, 1),
      timestamp: Date.now(),
      reasoning: `AI Prediction: ${prediction.direction} (${(prediction.confidence * 100).toFixed(1)}% confidence). ${prediction.reasoning}`
    };

    if (signal.action !== 'HOLD') {
      setSignals(prev => [signal, ...prev.slice(0, 49)]);
      
      // Save signal to database
      await saveSignal(signal, prediction, marketContext, indicators);
      
      // Execute trade if conditions are met
      if (shouldExecuteTrade(signal)) {
        await executeTrade(signal);
      }
    }
  }, [symbol, config, portfolio, currentSession, saveSignal, marketContext]);

  const shouldExecuteTrade = useCallback((signal: TradingSignal): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    
    if (openPositions.length >= config.maxOpenPositions) return false;
    if (signal.confidence < 0.8) return false;
    if (portfolio.dayPnL <= -config.maxDailyLoss * portfolio.baseCapital) return false;
    
    return true;
  }, [portfolio, config]);

  const executeTrade = useCallback(async (signal: TradingSignal) => {
    if (!currentSession) return;

    const positionSize = signal.quantity * signal.price;
    if (positionSize > portfolio.availableBalance) return;

    const newPosition: Position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: signal.symbol,
      side: signal.action as 'BUY' | 'SELL',
      size: signal.quantity,
      entryPrice: signal.price,
      currentPrice: signal.price,
      unrealizedPnL: 0,
      realizedPnL: 0,
      timestamp: signal.timestamp,
      status: 'OPEN'
    };

    // Update portfolio
    setPortfolio(prev => ({
      ...prev,
      availableBalance: prev.availableBalance - positionSize,
      positions: [...prev.positions, newPosition]
    }));

    // Save position to database
    await savePosition(newPosition);

    toast.success(`${signal.action} position opened: ${signal.quantity.toFixed(4)} ${symbol} @ $${signal.price.toFixed(2)}`);
  }, [currentSession, portfolio, savePosition, symbol]);

  // Update open positions with current prices
  useEffect(() => {
    const currentPrice = getCurrentPrice();
    if (currentPrice > 0 && portfolio.positions.length > 0) {
      setPortfolio(prev => {
        const updatedPositions = prev.positions.map(position => {
          if (position.status === 'OPEN') {
            const priceChange = currentPrice - position.entryPrice;
            const unrealizedPnL = position.side === 'BUY' ? 
              priceChange * position.size : 
              -priceChange * position.size;

            const updatedPosition = {
              ...position,
              currentPrice,
              unrealizedPnL
            };

            // Update position in database
            updatePosition(position.id, {
              currentPrice,
              unrealizedPnL
            });

            // Check for stop loss or take profit
            const pnlPercent = unrealizedPnL / (position.entryPrice * position.size);
            if (pnlPercent <= -config.stopLossPercentage || pnlPercent >= config.takeProfitPercentage) {
              closePosition(updatedPosition);
            }

            return updatedPosition;
          }
          return position;
        });

        const totalUnrealizedPnL = updatedPositions
          .filter(p => p.status === 'OPEN')
          .reduce((sum, p) => sum + p.unrealizedPnL, 0);

        const totalRealizedPnL = updatedPositions
          .reduce((sum, p) => sum + p.realizedPnL, 0);

        return {
          ...prev,
          positions: updatedPositions,
          totalPnL: totalRealizedPnL + totalUnrealizedPnL,
          equity: prev.availableBalance + totalUnrealizedPnL + 
                 updatedPositions.filter(p => p.status === 'OPEN')
                   .reduce((sum, p) => sum + (p.entryPrice * p.size), 0)
        };
      });
    }
  }, [bids, asks, getCurrentPrice, portfolio.positions.length, config, updatePosition]);

  const closePosition = useCallback(async (position: Position) => {
    const realizedPnL = position.unrealizedPnL;
    const positionValue = position.currentPrice * position.size;

    setPortfolio(prev => ({
      ...prev,
      availableBalance: prev.availableBalance + positionValue,
      positions: prev.positions.map(p => 
        p.id === position.id 
          ? { ...p, status: 'CLOSED' as const, realizedPnL }
          : p
      )
    }));

    // Update position in database
    await updatePosition(position.id, {
      status: 'CLOSED',
      realizedPnL
    });

    toast.info(`Position closed: ${realizedPnL > 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`);
  }, [updatePosition]);

  const getModelPerformance = useCallback(() => {
    return aiModel.current.getPerformanceMetrics();
  }, []);

  const updateConfig = useCallback((newConfig: Partial<TradingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Basic indicators for backwards compatibility
  const basicIndicators = indicators ? {
    rsi: indicators.rsi_14,
    ema_fast: indicators.ema_12,
    ema_slow: indicators.ema_26,
    macd: indicators.macd,
    signal: indicators.macd_signal
  } : null;

  const latestSignal = signals.length > 0 ? signals[0] : null;
  const activePositions = portfolio.positions.filter(p => p.status === 'OPEN');

  return {
    portfolio,
    indicators,
    marketContext,
    prediction,
    activePositions,
    config,
    updateConfig,
    getModelPerformance,
    signals,
    latestSignal,
    basicIndicators,
    currentSession,
    isRecovering,
    isAuthenticated,
    endSession
  };
};
