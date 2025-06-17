
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
    saveInterval: 3000, // 3 seconds
    snapshotInterval: 60000 // 1 minute
  });

  // Get the advanced trading system
  const tradingSystem = useAdvancedTradingSystem(symbol, bids, asks);

  const portfolioRef = useRef<Portfolio>(tradingSystem.portfolio);
  const positionsRef = useRef<Position[]>(tradingSystem.portfolio.positions);
  const initializationRef = useRef<boolean>(false);

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

  // Initialize session when user is authenticated (only once)
  useEffect(() => {
    const initializeSession = async () => {
      if (!persistence.isAuthenticated || isInitialized || initializationRef.current) return;

      initializationRef.current = true;

      try {
        console.log('[System] 🚀 Initializing trading session with persistence...');
        
        const session = await persistence.initializeSession(
          tradingSystem.portfolio,
          tradingSystem.config
        );

        if (session) {
          if (persistence.recoveredData) {
            console.log('[System] 📦 Session recovered successfully');
            toast.success(`Trading session recovered! Portfolio equity: $${persistence.recoveredData.portfolio.equity.toFixed(2)}`);
          } else {
            console.log('[System] 🆕 New trading session created');
            toast.success('New trading session started');
          }
          setIsInitialized(true);
          setSessionError(null);
        } else {
          throw new Error('Failed to initialize trading session');
        }
      } catch (error) {
        console.error('[System] ❌ Session initialization error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setSessionError(errorMessage);
        toast.error(`Failed to initialize trading session: ${errorMessage}`);
        initializationRef.current = false;
      }
    };

    initializeSession();
  }, [persistence.isAuthenticated, isInitialized]);

  // Auto-save portfolio state when it changes (with smart debouncing)
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const currentPortfolio = tradingSystem.portfolio;
    
    // Only save if portfolio has meaningful changes
    const equityDiff = Math.abs(currentPortfolio.equity - portfolioRef.current.equity);
    const pnlDiff = Math.abs(currentPortfolio.totalPnL - portfolioRef.current.totalPnL);
    const positionCountDiff = currentPortfolio.positions.length !== portfolioRef.current.positions.length;

    if (equityDiff > 0.5 || pnlDiff > 0.5 || positionCountDiff) {
      console.log(`[Portfolio Save] Changes detected - Equity: $${portfolioRef.current.equity.toFixed(2)} -> $${currentPortfolio.equity.toFixed(2)}`);
      persistence.savePortfolioState(currentPortfolio);
      portfolioRef.current = { ...currentPortfolio };
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
        persistence.savePosition(position);
      });
    }

    positionsRef.current = [...currentPositions];
  }, [tradingSystem.activePositions, isInitialized, persistence.currentSession, convertToPosition]);

  // Update existing positions with real-time prices (with optimized throttling)
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession || tradingSystem.activePositions.length === 0) return;

    // Update positions with current market prices more efficiently
    const updateInterval = setInterval(() => {
      const activeCount = tradingSystem.activePositions.length;
      if (activeCount > 0) {
        console.log(`[Real-time Update] Updating ${activeCount} positions with current market data`);
        
        tradingSystem.activePositions.forEach(positionTracking => {
          const updatedPosition = convertToPosition(positionTracking);
          persistence.updatePosition(updatedPosition.id, {
            currentPrice: updatedPosition.currentPrice,
            unrealizedPnL: updatedPosition.unrealizedPnL,
            timestamp: new Date().getTime()
          });
        });
      }
    }, 3000); // 3 second interval for better responsiveness

    return () => clearInterval(updateInterval);
  }, [tradingSystem.activePositions, isInitialized, persistence.currentSession, convertToPosition]);

  // Take periodic snapshots (less frequent)
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const snapshotInterval = setInterval(() => {
      persistence.takePortfolioSnapshot(
        tradingSystem.portfolio,
        tradingSystem.marketContext,
        tradingSystem.indicators
      );
    }, 60000); // 1 minute snapshots

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
      setSessionError(null);
      initializationRef.current = false;
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
