
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAdvancedTradingSystem } from './useAdvancedTradingSystem';
import { useTradingSessionPersistence } from './useTradingSessionPersistence';
import { Portfolio, Position } from '@/types/trading';
import { toast } from 'sonner';

export const useAdvancedTradingSystemWithPersistence = (
  symbol: string,
  bids: Array<{ price: number; quantity: number }>,
  asks: Array<{ price: number; quantity: number }>
) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  
  // Initialize persistence
  const persistence = useTradingSessionPersistence({
    symbol,
    autoSave: true,
    saveInterval: 5000, // 5 seconds
    snapshotInterval: 30000 // 30 seconds
  });

  // Get the advanced trading system
  const tradingSystem = useAdvancedTradingSystem(symbol, bids, asks);

  const portfolioRef = useRef<Portfolio>(tradingSystem.portfolio);
  const positionsRef = useRef<Position[]>(tradingSystem.portfolio.positions);

  // Get current market price for real-time updates
  const getCurrentPrice = useCallback(() => {
    if (bids.length > 0 && asks.length > 0) {
      return (bids[0].price + asks[0].price) / 2; // Mid price
    }
    return null;
  }, [bids, asks]);

  // Convert PositionTracking to Position for persistence with real-time price
  const convertToPosition = useCallback((positionTracking: any): Position => {
    const currentMarketPrice = getCurrentPrice();
    const currentPrice = currentMarketPrice || positionTracking.position.currentPrice;
    
    console.log(`[Position Update] Converting position ${positionTracking.position.id}:`);
    console.log(`  Entry Price: ${positionTracking.position.entryPrice}`);
    console.log(`  Stored Current Price: ${positionTracking.position.currentPrice}`);
    console.log(`  Market Current Price: ${currentMarketPrice}`);
    console.log(`  Using Price: ${currentPrice}`);

    // Calculate real-time unrealized PnL
    const priceDiff = currentPrice - positionTracking.position.entryPrice;
    const unrealizedPnL = positionTracking.position.side === 'BUY' 
      ? priceDiff * positionTracking.position.size
      : -priceDiff * positionTracking.position.size;

    return {
      id: positionTracking.position.id,
      symbol: positionTracking.position.symbol,
      side: positionTracking.position.side,
      size: positionTracking.position.size,
      entryPrice: positionTracking.position.entryPrice,
      currentPrice: currentPrice,
      unrealizedPnL: unrealizedPnL,
      realizedPnL: positionTracking.position.realizedPnL,
      timestamp: positionTracking.position.timestamp,
      status: positionTracking.position.status,
    };
  }, [getCurrentPrice]);

  // Debug current positions and prices
  useEffect(() => {
    if (tradingSystem.activePositions.length > 0) {
      console.log(`[Position Debug] Active positions count: ${tradingSystem.activePositions.length}`);
      console.log(`[Market Debug] Current bids/asks:`, { 
        bestBid: bids[0]?.price, 
        bestAsk: asks[0]?.price,
        midPrice: getCurrentPrice()
      });
      
      tradingSystem.activePositions.forEach((pos, index) => {
        console.log(`[Position ${index}] Entry: ${pos.position.entryPrice}, Current: ${pos.position.currentPrice}, ID: ${pos.position.id}`);
      });
    }
  }, [tradingSystem.activePositions, bids, asks, getCurrentPrice]);

  // Initialize session when user is authenticated
  useEffect(() => {
    const initializeSession = async () => {
      if (!persistence.isAuthenticated || isInitialized) return;

      try {
        console.log('[System] 🚀 Initializing trading session with persistence...');
        
        const session = await persistence.initializeSession(
          tradingSystem.portfolio,
          tradingSystem.config
        );

        if (session) {
          if (persistence.recoveredData) {
            console.log('[System] 📦 Session recovered, applying recovered data...');
            toast.success(`Trading session recovered! Portfolio equity: $${persistence.recoveredData.portfolio.equity.toFixed(2)}`);
          } else {
            console.log('[System] 🆕 New trading session created');
            toast.success('New trading session started');
          }
          setIsInitialized(true);
        } else {
          setSessionError('Failed to initialize trading session');
          toast.error('Failed to initialize trading session');
        }
      } catch (error) {
        console.error('[System] ❌ Session initialization error:', error);
        setSessionError(error instanceof Error ? error.message : 'Unknown error');
        toast.error('Failed to initialize trading session');
      }
    };

    initializeSession();
  }, [persistence.isAuthenticated, isInitialized]);

  // Auto-save portfolio state when it changes
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const currentPortfolio = tradingSystem.portfolio;
    
    // Only save if portfolio has meaningful changes
    if (
      Math.abs(currentPortfolio.equity - portfolioRef.current.equity) > 0.01 ||
      currentPortfolio.positions.length !== portfolioRef.current.positions.length
    ) {
      console.log(`[Portfolio Save] Equity changed: ${portfolioRef.current.equity} -> ${currentPortfolio.equity}`);
      persistence.savePortfolioState(currentPortfolio);
      portfolioRef.current = currentPortfolio;
    }
  }, [tradingSystem.portfolio, isInitialized, persistence.currentSession]);

  // Save new positions (convert PositionTracking to Position with real-time prices)
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const currentPositions = tradingSystem.activePositions.map(convertToPosition);
    const newPositions = currentPositions.filter(
      pos => !positionsRef.current.find(oldPos => oldPos.id === pos.id)
    );

    if (newPositions.length > 0) {
      console.log(`[Position Save] Saving ${newPositions.length} new positions`);
      newPositions.forEach(position => {
        console.log(`[Position Save] Position ${position.id}: Entry=${position.entryPrice}, Current=${position.currentPrice}, PnL=${position.unrealizedPnL}`);
        persistence.savePosition(position);
      });
    }

    positionsRef.current = currentPositions;
  }, [tradingSystem.activePositions, isInitialized, persistence.currentSession, convertToPosition]);

  // Update existing positions with real-time prices
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession || tradingSystem.activePositions.length === 0) return;

    console.log(`[Real-time Update] Updating ${tradingSystem.activePositions.length} positions with current market price`);
    
    tradingSystem.activePositions.forEach(positionTracking => {
      const updatedPosition = convertToPosition(positionTracking);
      persistence.updatePosition(persistence.currentSession!.id, updatedPosition.id, {
        current_price: updatedPosition.currentPrice,
        unrealized_pnl: updatedPosition.unrealizedPnL,
        updated_at: new Date().toISOString()
      });
    });
  }, [bids, asks, tradingSystem.activePositions, isInitialized, persistence.currentSession, convertToPosition]);

  // Take periodic snapshots
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const snapshotInterval = setInterval(() => {
      persistence.takePortfolioSnapshot(
        tradingSystem.portfolio,
        tradingSystem.marketContext,
        tradingSystem.indicators
      );
    }, 30000); // 30 seconds

    return () => clearInterval(snapshotInterval);
  }, [isInitialized, persistence.currentSession, tradingSystem.portfolio]);

  // Save trading signals
  const saveSignal = useCallback(async (signal: any) => {
    if (!persistence.currentSession) return null;
    
    return await persistence.saveSignal(
      signal,
      tradingSystem.prediction,
      tradingSystem.marketContext,
      tradingSystem.indicators
    );
  }, [persistence.currentSession, tradingSystem.prediction, tradingSystem.marketContext, tradingSystem.indicators]);

  // End session handler
  const endSession = useCallback(async () => {
    if (persistence.currentSession) {
      await persistence.endSession();
      setIsInitialized(false);
      toast.success('Trading session ended');
    }
  }, [persistence.currentSession]);

  return {
    // Trading system data
    ...tradingSystem,
    
    // Session persistence data
    currentSession: persistence.currentSession,
    isRecovering: persistence.isRecovering,
    isAuthenticated: persistence.isAuthenticated,
    recoveredData: persistence.recoveredData,
    isInitialized,
    sessionError,
    
    // Session actions
    saveSignal,
    endSession,
    
    // Override portfolio with recovered data if available
    portfolio: persistence.recoveredData?.portfolio || tradingSystem.portfolio,
  };
};
