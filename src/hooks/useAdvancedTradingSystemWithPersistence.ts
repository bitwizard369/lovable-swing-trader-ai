
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
  const positionsRef = useRef<Position[]>(tradingSystem.activePositions);

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
      persistence.savePortfolioState(currentPortfolio);
      portfolioRef.current = currentPortfolio;
    }
  }, [tradingSystem.portfolio, isInitialized, persistence.currentSession]);

  // Save new positions
  useEffect(() => {
    if (!isInitialized || !persistence.currentSession) return;

    const newPositions = tradingSystem.activePositions.filter(
      pos => !positionsRef.current.find(oldPos => oldPos.id === pos.id)
    );

    newPositions.forEach(position => {
      persistence.savePosition(position);
    });

    positionsRef.current = tradingSystem.activePositions;
  }, [tradingSystem.activePositions, isInitialized, persistence.currentSession]);

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
    
    // Override portfolio and positions with recovered data if available
    portfolio: persistence.recoveredData?.portfolio || tradingSystem.portfolio,
    activePositions: persistence.recoveredData?.positions || tradingSystem.activePositions,
  };
};
