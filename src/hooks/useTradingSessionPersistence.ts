
import { useState, useEffect, useCallback, useRef } from 'react';
import { tradingService, TradingSession, DatabasePosition, SystemHealthCheck } from '@/services/supabaseTradingService';
import { Portfolio, Position } from '@/types/trading';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface SessionPersistenceConfig {
  symbol: string;
  autoSave: boolean;
  saveInterval: number; // milliseconds
  snapshotInterval: number; // milliseconds
  healthCheckInterval?: number; // milliseconds
}

export const useTradingSessionPersistence = (config: SessionPersistenceConfig) => {
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<TradingSession | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealthCheck[]>([]);
  const [recoveredData, setRecoveredData] = useState<{
    portfolio: Portfolio;
    positions: Position[];
  } | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const snapshotTimeoutRef = useRef<NodeJS.Timeout>();
  const healthCheckIntervalRef = useRef<NodeJS.Timeout>();
  const lastSaveDataRef = useRef<string>('');
  const cleanupInProgressRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

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

  // System health monitoring with error handling and backoff
  useEffect(() => {
    if (!isAuthenticated || !config.healthCheckInterval) return;

    const checkSystemHealth = async () => {
      if (cleanupInProgressRef.current) return;

      try {
        const health = await tradingService.getSystemHealth();
        setSystemHealth(health);
        consecutiveErrorsRef.current = 0; // Reset error counter on success

        // Show warnings for unhealthy metrics (reduced frequency)
        health.forEach(metric => {
          if (metric.status === 'CLEANUP_NEEDED') {
            console.warn(`[Health] Cleanup needed for ${metric.metric}: ${metric.value}`);
            // Only show toast for critical issues, reduce noise
            if (metric.value > 10) {
              toast({
                title: 'System Cleanup Required',
                description: `Found ${metric.value} stale ${metric.metric.replace('_', ' ')}`,
                variant: 'destructive'
              });
            }
          }
        });
      } catch (error) {
        consecutiveErrorsRef.current++;
        console.error('[Health] Error checking system health:', error);
        
        // Exponential backoff for consecutive errors
        if (consecutiveErrorsRef.current > 3) {
          console.warn('[Health] Too many consecutive errors, temporarily disabling health checks');
          if (healthCheckIntervalRef.current) {
            clearInterval(healthCheckIntervalRef.current);
          }
          // Re-enable after 5 minutes
          setTimeout(() => {
            consecutiveErrorsRef.current = 0;
            if (config.healthCheckInterval) {
              healthCheckIntervalRef.current = setInterval(checkSystemHealth, config.healthCheckInterval);
            }
          }, 300000);
        }
      }
    };

    // Initial health check with delay
    const initialTimeout = setTimeout(checkSystemHealth, 2000);

    // Set up interval with increased frequency for better monitoring
    const adjustedInterval = Math.max(config.healthCheckInterval, 30000); // Minimum 30 seconds
    healthCheckIntervalRef.current = setInterval(checkSystemHealth, adjustedInterval);

    return () => {
      clearTimeout(initialTimeout);
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [isAuthenticated, config.healthCheckInterval, toast]);

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
        
        // Validate and cleanup positions
        const validation = await tradingService.validateSessionPositions(existingSession.id);
        if (validation) {
          console.log(`[Session] 📊 Position validation:`, validation);
          
          if (validation.validation_status.includes('CLEANED')) {
            toast({
              title: 'Session Cleaned',
              description: validation.validation_status,
              variant: 'default'
            });
          }
        }
        
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

          toast({
            title: 'Session Recovered',
            description: `Recovered ${convertedPositions.length} positions. Equity: $${recoveredPortfolio.equity.toFixed(2)}`,
            variant: 'default'
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
        toast({
          title: 'New Session Started',
          description: `Trading session created for ${config.symbol.toUpperCase()}`,
          variant: 'default'
        });
        console.log(`[Session] ✅ New session created: ${newSession.id}`);
      }

      return newSession;
    } catch (error) {
      console.error('[Session] Error initializing session:', error);
      toast({
        title: 'Session Error',
        description: 'Failed to initialize trading session',
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsRecovering(false);
    }
  }, [config.symbol, isAuthenticated, toast]);

  // Save portfolio state with enhanced validation and reduced frequency
  const savePortfolioState = useCallback(async (portfolio: Portfolio) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return;

    // Debounce saves to avoid too many database calls (increased to 3 seconds)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Only save if data has significantly changed (increase threshold)
        const currentData = JSON.stringify({
          balance: Math.round(portfolio.availableBalance * 100) / 100, // Round to avoid minor differences
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

        // Reduced logging frequency
        if (Math.random() < 0.1) { // Only log 10% of saves
          console.log(`[Session] 💾 Portfolio state saved - Equity: ${portfolio.equity.toFixed(2)}`);
        }
      } catch (error) {
        console.error('[Session] Error saving portfolio state:', error);
      }
    }, 3000); // Increased debounce to 3 seconds
  }, [currentSession, isAuthenticated]);

  // Save position with enhanced lifecycle management
  const savePosition = useCallback(async (position: Position) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return;

    try {
      await tradingService.savePosition(currentSession.id, position);
      console.log(`[Session] 📍 Position saved: ${position.side} ${position.symbol}`);
    } catch (error) {
      console.error('[Session] Error saving position:', error);
      toast({
        title: 'Position Save Error',
        description: `Failed to save ${position.side} position`,
        variant: 'destructive'
      });
    }
  }, [currentSession, isAuthenticated, toast]);

  // Update position
  const updatePosition = useCallback(async (positionId: string, updates: Partial<Position>) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return;

    try {
      const dbUpdates: any = {};
      if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
      if (updates.unrealizedPnL !== undefined) dbUpdates.unrealized_pnl = updates.unrealizedPnL;
      if (updates.realizedPnL !== undefined) dbUpdates.realized_pnl = updates.realizedPnL;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      await tradingService.updatePosition(currentSession.id, positionId, dbUpdates);
    } catch (error) {
      console.error('[Session] Error updating position:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Close position
  const closePosition = useCallback(async (positionId: string, exitPrice: number, realizedPnL: number) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return;

    try {
      await tradingService.closePosition(currentSession.id, positionId, exitPrice, realizedPnL);
      toast({
        title: 'Position Closed',
        description: `PnL: ${realizedPnL >= 0 ? '+' : ''}$${realizedPnL.toFixed(2)}`,
        variant: realizedPnL >= 0 ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('[Session] Error closing position:', error);
      toast({
        title: 'Position Close Error',
        description: 'Failed to close position',
        variant: 'destructive'
      });
    }
  }, [currentSession, isAuthenticated, toast]);

  // Manual cleanup functions with safety checks
  const cleanupSession = useCallback(async () => {
    if (!currentSession || cleanupInProgressRef.current) return;

    try {
      cleanupInProgressRef.current = true;
      await tradingService.cleanupSessionPositions(currentSession.id);
      toast({
        title: 'Session Cleaned',
        description: 'Stale positions have been cleaned up',
        variant: 'default'
      });
    } catch (error) {
      console.error('[Session] Error cleaning up session:', error);
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [currentSession, toast]);

  const resetSession = useCallback(async () => {
    if (!currentSession || cleanupInProgressRef.current) return;

    try {
      cleanupInProgressRef.current = true;
      await tradingService.resetSession(currentSession.id);
      setRecoveredData(null);
      toast({
        title: 'Session Reset',
        description: 'All positions closed and balances reset',
        variant: 'default'
      });
    } catch (error) {
      console.error('[Session] Error resetting session:', error);
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [currentSession, toast]);

  // AI Model reset functions
  const resetAIModel = useCallback(async () => {
    if (!currentSession) return;

    try {
      // Reset session to clear AI model state
      await resetSession();
      
      toast({
        title: 'AI Model Reset',
        description: 'AI model state cleared and synced with database',
        variant: 'default'
      });
    } catch (error) {
      console.error('[Session] Error resetting AI model:', error);
    }
  }, [currentSession, resetSession, toast]);

  const syncDatabase = useCallback(async () => {
    if (!currentSession) return;

    try {
      // Force a fresh recovery to sync AI model with database
      const recoveryData = await tradingService.recoverTradingSession(currentSession.id);
      
      if (recoveryData) {
        // Update recovered data to trigger AI model re-training
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

        toast({
          title: 'Database Synced',
          description: `AI model updated with ${convertedPositions.length} trade records`,
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('[Session] Error syncing database:', error);
    }
  }, [currentSession, toast]);

  // Save signal
  const saveSignal = useCallback(async (signal: any, prediction?: any, marketContext?: any, indicators?: any) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return null;

    try {
      const savedSignal = await tradingService.saveSignal(currentSession.id, signal, prediction, marketContext, indicators);
      return savedSignal;
    } catch (error) {
      console.error('[Session] Error saving signal:', error);
      return null;
    }
  }, [currentSession, isAuthenticated]);

  // Take portfolio snapshot with reduced frequency
  const takePortfolioSnapshot = useCallback(async (portfolio: Portfolio, marketContext?: any, indicators?: any) => {
    if (!currentSession || !isAuthenticated || cleanupInProgressRef.current) return;

    try {
      await tradingService.savePortfolioSnapshot(currentSession.id, portfolio, marketContext, indicators);
      // Reduced logging frequency
      if (Math.random() < 0.05) { // Only log 5% of snapshots
        console.log(`[Session] 📸 Portfolio snapshot taken`);
      }
    } catch (error) {
      console.error('[Session] Error taking portfolio snapshot:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Auto-save and snapshot intervals
  useEffect(() => {
    if (!config.autoSave || !currentSession) return;

    // Auto portfolio snapshots (no action needed here as it's handled by trading system)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (snapshotTimeoutRef.current) clearTimeout(snapshotTimeoutRef.current);
    };
  }, [config.autoSave, config.snapshotInterval, currentSession]);

  // End session
  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      await tradingService.endTradingSession(currentSession.id);
      setCurrentSession(null);
      setRecoveredData(null);
      toast({
        title: 'Session Ended',
        description: 'Trading session has been stopped',
        variant: 'default'
      });
      console.log(`[Session] 🛑 Session ended: ${currentSession.id}`);
    } catch (error) {
      console.error('[Session] Error ending session:', error);
    }
  }, [currentSession, toast]);

  return {
    currentSession,
    isRecovering,
    isAuthenticated,
    recoveredData,
    systemHealth,
    initializeSession,
    savePortfolioState,
    savePosition,
    updatePosition,
    closePosition,
    saveSignal,
    takePortfolioSnapshot,
    cleanupSession,
    resetSession,
    resetAIModel,
    syncDatabase,
    endSession
  };
};
