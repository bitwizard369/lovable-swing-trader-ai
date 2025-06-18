import { useState, useEffect, useCallback, useRef } from 'react';
import { Portfolio, Position, MarketContext, TechnicalIndicators } from '@/types/trading';
import { advancedTechnicalAnalysis } from '@/services/advancedTechnicalAnalysis';
import { AIModel } from '@/services/aiPredictionModel';
import { useTradingSessionPersistence } from './useTradingSessionPersistence';

interface TradingConfig {
  symbol: string;
  initialBalance: number;
  maxPositions: number;
  riskPerTrade: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  trailingStopPercent: number;
  persistence?: any; // Add persistence config
}

export const useAdvancedTradingSystem = (config: TradingConfig) => {
  const [portfolioState, setPortfolioState] = useState<Portfolio>({
    baseCapital: config.initialBalance,
    availableBalance: config.initialBalance,
    lockedProfits: 0,
    positions: [],
    totalPnL: 0,
    dayPnL: 0,
    equity: config.initialBalance
  });

  const [currentConfig, setCurrentConfig] = useState(config);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [currentIndicators, setCurrentIndicators] = useState<TechnicalIndicators>({} as TechnicalIndicators);
  const [currentMarketContext, setCurrentMarketContext] = useState<MarketContext>({} as MarketContext);
  const [currentPrediction, setCurrentPrediction] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [latestSignal, setLatestSignal] = useState<any>(null);

  const aiModelRef = useRef<AIModel | null>(null);
  const lastTradeTimeRef = useRef<number>(0);

  const activePositions = portfolioState.positions.filter(p => p.status === 'OPEN');
  const generatePositionId = () => `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const calculatePnL = useCallback((position: Position, currentPrice: number) => {
    const priceDifference = currentPrice - position.entryPrice;
    const profitLoss = priceDifference * position.size * (position.side === 'BUY' ? 1 : -1);
    return profitLoss;
  }, []);

  const calculateRealizedPnL = useCallback((position: Position, exitPrice: number) => {
    const priceDifference = exitPrice - position.entryPrice;
    const profitLoss = priceDifference * position.size * (position.side === 'BUY' ? 1 : -1);
    return profitLoss;
  }, []);

  const updateConfig = useCallback((newConfig: Partial<TradingConfig>) => {
    setCurrentConfig(prevConfig => ({ ...prevConfig, ...newConfig }));
  }, []);

  // Add event emitter for database sync
  const [eventListeners] = useState(() => new Map<string, Function[]>());

  const emit = useCallback((event: string, ...args: any[]) => {
    const listeners = eventListeners.get(event) || [];
    listeners.forEach(listener => listener(...args));
  }, [eventListeners]);

  const on = useCallback((event: string, listener: Function) => {
    const listeners = eventListeners.get(event) || [];
    listeners.push(listener);
    eventListeners.set(event, listeners);
  }, [eventListeners]);

  const off = useCallback((event: string, listener: Function) => {
    const listeners = eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      eventListeners.set(event, listeners);
    }
  }, [eventListeners]);

  // Add method to manually set portfolio (for recovery)
  const setPortfolio = useCallback((newPortfolio: Portfolio) => {
    console.log('[Trading System] 🔄 Setting portfolio from database recovery');
    setPortfolioState(newPortfolio);
  }, []);

  // Add method to sync individual positions (for recovery)
  const syncPosition = useCallback((position: Position) => {
    console.log('[Trading System] 🔄 Syncing position from database:', position.id);
    // Position is already in the portfolio from setPortfolio, just log for tracking
  }, []);

  // Enhanced openPosition with database sync events
  const openPosition = useCallback(async (
    side: 'BUY' | 'SELL',
    size: number,
    price: number,
    prediction?: any
  ): Promise<Position | null> => {
    try {
      if (portfolioState.positions.filter(p => p.status === 'OPEN').length >= config.maxPositions) {
        console.warn('[Trading] Maximum positions reached');
        return null;
      }

      const positionValue = size * price;
      if (positionValue > portfolioState.availableBalance) {
        console.warn('[Trading] Insufficient balance for position');
        return null;
      }

      const newPosition: Position = {
        id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: config.symbol,
        side,
        size,
        entryPrice: price,
        currentPrice: price,
        unrealizedPnL: 0,
        realizedPnL: 0,
        timestamp: Date.now(),
        status: 'OPEN'
      };

      // Update portfolio
      const updatedPortfolio = {
        ...portfolioState,
        availableBalance: portfolioState.availableBalance - positionValue,
        positions: [...portfolioState.positions, newPosition]
      };

      setPortfolioState(updatedPortfolio);

      // Emit event for database sync
      emit('positionOpened', newPosition);

      console.log(`[Trading] ✅ Position opened: ${side} ${size} ${config.symbol} at ${price}`);
      return newPosition;

    } catch (error) {
      console.error('[Trading] Error opening position:', error);
      return null;
    }
  }, [config.symbol, config.maxPositions, portfolioState, emit]);

  // Enhanced position updates with database sync
  const updatePositions = useCallback((currentPrice: number) => {
    if (portfolioState.positions.length === 0) return;

    const updatedPositions = portfolioState.positions.map(position => {
      if (position.status === 'OPEN') {
        const oldPnL = position.unrealizedPnL;
        const oldPrice = position.currentPrice;
        
        const updatedPosition = {
          ...position,
          currentPrice,
          unrealizedPnL: (currentPrice - position.entryPrice) * position.size * (position.side === 'BUY' ? 1 : -1)
        };

        // Emit update event for significant changes
        if (Math.abs(updatedPosition.unrealizedPnL - oldPnL) > 0.01 || Math.abs(currentPrice - oldPrice) > 0.01) {
          emit('positionUpdated', position.id, {
            currentPrice: updatedPosition.currentPrice,
            unrealizedPnL: updatedPosition.unrealizedPnL
          });
        }

        return updatedPosition;
      }
      return position;
    });

    // Calculate new equity
    const totalUnrealizedPnL = updatedPositions
      .filter(p => p.status === 'OPEN')
      .reduce((sum, p) => sum + p.unrealizedPnL, 0);

    const newEquity = portfolioState.baseCapital + portfolioState.totalPnL + totalUnrealizedPnL;

    setPortfolioState(prev => ({
      ...prev,
      positions: updatedPositions,
      totalPnL: newTotalPnL,
      availableBalance: newAvailableBalance,
      equity: newEquity
    }));

  }, [portfolioState, emit]);

  // Enhanced closePosition with database sync
  const closePosition = useCallback((
    positionId: string,
    exitPrice: number,
    reason: string = 'Manual'
  ): boolean => {
    const position = portfolioState.positions.find(p => p.id === positionId && p.status === 'OPEN');
    if (!position) {
      console.warn(`[Trading] Position ${positionId} not found or already closed`);
      return false;
    }

    const realizedPnL = (exitPrice - position.entryPrice) * position.size * (position.side === 'BUY' ? 1 : -1);
    const positionValue = position.size * exitPrice;

    // Update position status
    const updatedPositions = portfolioState.positions.map(p =>
      p.id === positionId
        ? { ...p, status: 'CLOSED' as const, currentPrice: exitPrice, realizedPnL }
        : p
    );

    // Update portfolio
    const newTotalPnL = portfolioState.totalPnL + realizedPnL;
    const newAvailableBalance = portfolioState.availableBalance + positionValue;
    const newEquity = portfolioState.baseCapital + newTotalPnL;

    setPortfolioState(prev => ({
      ...prev,
      positions: updatedPositions,
      totalPnL: newTotalPnL,
      availableBalance: newAvailableBalance,
      equity: newEquity
    }));

    // Emit event for database sync
    emit('positionClosed', positionId, exitPrice, realizedPnL);

    console.log(`[Trading] 🔒 Position closed: ${positionId} with PnL: ${realizedPnL.toFixed(2)}`);
    return true;

  }, [portfolioState, emit]);

  const updatePrice = useCallback((price: number, volume: number) => {
    setCurrentPrice(price);
    setCurrentVolume(volume);
    updatePositions(price);
  }, [updatePositions]);

  const analyzeMarket = useCallback(async (price: number, volume: number) => {
    const indicators = await advancedTechnicalAnalysis(price, volume);
    setCurrentIndicators(indicators);

    const marketContext = {
      trend: indicators.macd > 0 ? 'Uptrend' : 'Downtrend',
      volatility: indicators.atr,
      momentum: indicators.rsi
    };
    setCurrentMarketContext(marketContext);

    return { indicators, marketContext };
  }, []);

  const getModelPerformance = useCallback(() => {
    // Mocked performance data
    return {
      sharpeRatio: 0.75,
      winRate: 0.60,
      avgWin: 250,
      avgLoss: -150,
      profitFactor: 1.67,
      totalTrades: 500,
      winningTrades: 300,
      losingTrades: 200,
      maxDrawdown: -750
    };
  }, []);

  useEffect(() => {
    if (currentPrice === 0 || currentVolume === 0) return;

    const runAnalysis = async () => {
      const { indicators, marketContext } = await analyzeMarket(currentPrice, currentVolume);

      // Basic signal logic
      if (indicators.rsi > 70) {
        setLatestSignal({ action: 'SELL', price: currentPrice, reasoning: 'RSI Overbought' });
        setSignals(prev => [...prev, { action: 'SELL', price: currentPrice, reasoning: 'RSI Overbought' }]);
      } else if (indicators.rsi < 30) {
        setLatestSignal({ action: 'BUY', price: currentPrice, reasoning: 'RSI Oversold' });
        setSignals(prev => [...prev, { action: 'BUY', price: currentPrice, reasoning: 'RSI Oversold' }]);
      } else {
        setLatestSignal({ action: 'HOLD', price: currentPrice, reasoning: 'Neutral Indicators' });
      }

      // AI Model integration (mock)
      if (aiModelRef.current) {
        const prediction = await aiModelRef.current.predict(marketContext, indicators);
        setCurrentPrediction(prediction);
      }
    };

    runAnalysis();
  }, [currentPrice, currentVolume, analyzeMarket]);

  useEffect(() => {
    aiModelRef.current = new AIModel(); // Initialize AI model
    return () => {
      aiModelRef.current = null; // Cleanup on unmount
    };
  }, []);

  return {
    portfolio: portfolioState,
    indicators: currentIndicators,
    marketContext: currentMarketContext,
    prediction: currentPrediction,
    activePositions,
    config: currentConfig,
    updateConfig,
    getModelPerformance,
    signals,
    latestSignal,
    basicIndicators: currentIndicators,
    updatePrice,
    openPosition,
    closePosition,
    // New methods for database sync
    setPortfolio,
    syncPosition,
    on,
    off,
    emit,
  };
};
