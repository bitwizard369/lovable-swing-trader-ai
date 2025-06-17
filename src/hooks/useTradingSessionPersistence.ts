
import { useState, useEffect, useCallback, useRef } from 'react';
import { tradingService, TradingSession, DatabasePosition } from '@/services/supabaseTradingService';
import { Portfolio, Position } from '@/types/trading';
import { supabase } from '@/integrations/supabase/client';

interface SessionPersistenceConfig {
  symbol: string;
  autoSave: boolean;
  saveInterval: number; // milliseconds
  snapshotInterval: number; // milliseconds
}

export const useTradingSessionPersistence = (config: SessionPersistenceConfig) => {
  const [currentSession, setCurrentSession] = useState<TradingSession | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recoveredData, setRecoveredData] = useState<{
    portfolio: Portfolio;
    positions: Position[];
  } | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const snapshotTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveDataRef = useRef<string>('');
  const lastPriceUpdateRef = useRef<Map<string, { price: number, pnl: number }>>(new Map());

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize or recover session
  const initializeSession = useCallback(async (initialPortfolio: Portfolio, tradingConfig: any) => {
    if (!isAuthenticated) {
      console.log('[Session] User not authenticated, skipping session initialization');
      return null;
    }

    try {
      setIsRecovering(true);

      // Try to get existing active session
      const existingSession = await tradingService.getActiveTradingSession(config.symbol);
      
      if (existingSession) {
        console.log(`[Session] 🔄 Recovering existing session: ${existingSession.id}`);
        
        // Recover session data
        const recoveryData = await tradingService.recoverTradingSession(existingSession.id);
        
        if (recoveryData) {
          setCurrentSession(recoveryData.session);
          
          // Convert database positions back to trading system format
          const convertedPositions: Position[] = recoveryData.positions.map(dbPos => ({
            id: dbPos.external_id,
            symbol: dbPos.symbol,
            side: dbPos.side,
            size: dbPos.size,
            entryPrice: dbPos.entry_price,
            currentPrice: dbPos.current_price,
            unrealizedPnL: dbPos.unrealized_pnl,
            realizedPnL: dbPos.realized_pnl,
            timestamp: new Date(dbPos.entry_time).getTime(),
            status: dbPos.status
          }));

          // Reconstruct portfolio from last snapshot or session data
          const recoveredPortfolio: Portfolio = {
            baseCapital: recoveryData.lastSnapshot?.base_capital || recoveryData.session.initial_balance,
            availableBalance: recoveryData.lastSnapshot?.available_balance || recoveryData.session.current_balance,
            lockedProfits: recoveryData.lastSnapshot?.locked_profits || recoveryData.session.locked_profits,
            positions: convertedPositions,
            totalPnL: recoveryData.lastSnapshot?.total_pnl || recoveryData.session.total_pnl,
            dayPnL: recoveryData.lastSnapshot?.day_pnl || recoveryData.session.day_pnl,
            equity: recoveryData.lastSnapshot?.equity || recoveryData.session.equity
          };

          setRecoveredData({
            portfolio: recoveredPortfolio,
            positions: convertedPositions
          });

          console.log(`[Session] ✅ Session recovered with ${convertedPositions.length} positions, Equity: ${recoveredPortfolio.equity.toFixed(2)}`);
          return recoveryData.session;
        }
      }

      // Create new session
      console.log('[Session] 🆕 Creating new trading session');
      const newSession = await tradingService.createTradingSession({
        symbol: config.symbol,
        start_time: new Date().toISOString(),
        end_time: null,
        status: 'active',
        initial_balance: initialPortfolio.baseCapital,
        current_balance: initialPortfolio.availableBalance,
        locked_profits: initialPortfolio.lockedProfits,
        total_pnl: initialPortfolio.totalPnL,
        day_pnl: initialPortfolio.dayPnL,
        equity: initialPortfolio.equity,
        config: tradingConfig
      });

      if (newSession) {
        setCurrentSession(newSession);
        console.log(`[Session] ✅ New session created: ${newSession.id}`);
      }

      return newSession;
    } catch (error) {
      console.error('[Session] Error initializing session:', error);
      return null;
    } finally {
      setIsRecovering(false);
    }
  }, [config.symbol, isAuthenticated]);

  // Save portfolio state with better debouncing
  const savePortfolioState = useCallback(async (portfolio: Portfolio) => {
    if (!currentSession || !isAuthenticated) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Only save if data has changed significantly
        const currentData = JSON.stringify({
          balance: Math.round(portfolio.availableBalance * 100) / 100,
          equity: Math.round(portfolio.equity * 100) / 100,
          pnl: Math.round(portfolio.totalPnL * 100) / 100,
          positions: portfolio.positions.length
        });

        if (currentData === lastSaveDataRef.current) return;
        lastSaveDataRef.current = currentData;

        // Update session with current portfolio state
        await tradingService.updateTradingSession(currentSession.id, {
          current_balance: portfolio.availableBalance,
          locked_profits: portfolio.lockedProfits,
          total_pnl: portfolio.totalPnL,
          day_pnl: portfolio.dayPnL,
          equity: portfolio.equity
        });

        console.log(`[Session] 💾 Portfolio state saved - Equity: ${portfolio.equity.toFixed(2)}, P&L: ${portfolio.totalPnL.toFixed(2)}`);
      } catch (error) {
        console.error('[Session] Error saving portfolio state:', error);
      }
    }, 1000); // 1 second debounce
  }, [currentSession, isAuthenticated]);

  // Save position
  const savePosition = useCallback(async (position: Position) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      await tradingService.savePosition(currentSession.id, position);
      console.log(`[Session] 📍 Position saved: ${position.side} ${position.symbol} @ ${position.currentPrice}`);
    } catch (error) {
      console.error('[Session] Error saving position:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Updated to use the new optimized price update function
  const updatePosition = useCallback(async (positionId: string, updates: Partial<Position>) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      // Check if this is a price/PnL update and use the optimized function
      if (updates.currentPrice !== undefined && updates.unrealizedPnL !== undefined) {
        const lastUpdate = lastPriceUpdateRef.current.get(positionId);
        
        // Only update if price or PnL has changed significantly (to avoid unnecessary DB calls)
        if (!lastUpdate || 
            Math.abs(lastUpdate.price - updates.currentPrice) > 0.01 || 
            Math.abs(lastUpdate.pnl - updates.unrealizedPnL) > 0.01) {
          
          await tradingService.updatePositionPriceAndPnL(
            currentSession.id, 
            positionId, 
            updates.currentPrice, 
            updates.unrealizedPnL
          );
          
          lastPriceUpdateRef.current.set(positionId, {
            price: updates.currentPrice,
            pnl: updates.unrealizedPnL
          });
        }
      } else {
        // For other updates, use the legacy method
        const dbUpdates: any = {};
        if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
        if (updates.unrealizedPnL !== undefined) dbUpdates.unrealized_pnl = updates.unrealizedPnL;
        if (updates.realizedPnL !== undefined) dbUpdates.realized_pnl = updates.realizedPnL;
        if (updates.status !== undefined) dbUpdates.status = updates.status;

        await tradingService.updatePosition(currentSession.id, positionId, dbUpdates);
      }
    } catch (error) {
      console.error('[Session] Error updating position:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Save signal
  const saveSignal = useCallback(async (signal: any, prediction?: any, marketContext?: any, indicators?: any) => {
    if (!currentSession || !isAuthenticated) return null;

    try {
      const savedSignal = await tradingService.saveSignal(currentSession.id, signal, prediction, marketContext, indicators);
      return savedSignal;
    } catch (error) {
      console.error('[Session] Error saving signal:', error);
      return null;
    }
  }, [currentSession, isAuthenticated]);

  const takePortfolioSnapshot = useCallback(async (portfolio: Portfolio, marketContext?: any, indicators?: any) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      await tradingService.savePortfolioSnapshot(currentSession.id, portfolio, marketContext, indicators);
      console.log(`[Session] 📸 Portfolio snapshot taken`);
    } catch (error) {
      console.error('[Session] Error taking portfolio snapshot:', error);
    }
  }, [currentSession, isAuthenticated]);

  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      await tradingService.endTradingSession(currentSession.id);
      setCurrentSession(null);
      setRecoveredData(null);
      lastPriceUpdateRef.current.clear();
      console.log(`[Session] 🛑 Session ended: ${currentSession.id}`);
    } catch (error) {
      console.error('[Session] Error ending session:', error);
    }
  }, [currentSession]);

  // Auto-save and snapshot intervals
  useEffect(() => {
    if (!config.autoSave || !currentSession) return;

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (snapshotTimeoutRef.current) clearTimeout(snapshotTimeoutRef.current);
    };
  }, [config.autoSave, currentSession]);

  return {
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
  };
};
