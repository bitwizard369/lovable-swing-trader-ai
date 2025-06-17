import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Portfolio, Position, TradingSignal } from '@/types/trading';
import { AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';

interface TradingSession {
  id: string;
  symbol: string;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'paused' | 'completed';
  initial_balance: number;
  current_balance: number;
  locked_profits: number;
  total_pnl: number;
  day_pnl: number;
  equity: number;
  config: any;
  user_id: string;
}

interface DatabasePosition {
  id: string;
  session_id: string;
  external_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entry_price: number;
  current_price: number;
  unrealized_pnl: number;
  realized_pnl: number;
  entry_time: string;
  exit_time: string | null;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
}

interface PortfolioSnapshot {
  id: string;
  session_id: string;
  snapshot_time: string;
  base_capital: number;
  available_balance: number;
  locked_profits: number;
  total_pnl: number;
  day_pnl: number;
  equity: number;
  market_context: any;
  indicators: any;
}

export const useSupabaseTradingPersistence = (symbol: string) => {
  const [currentSession, setCurrentSession] = useState<TradingSession | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [recoveredData, setRecoveredData] = useState<{
    portfolio: Portfolio;
    positions: Position[];
  } | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSaveDataRef = useRef<string>('');

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
      if (!session?.user) {
        setCurrentSession(null);
        setRecoveredData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize or recover session
  const initializeSession = useCallback(async (initialPortfolio: Portfolio, tradingConfig: any) => {
    if (!isAuthenticated) {
      console.log('[Supabase] User not authenticated, skipping session initialization');
      return null;
    }

    try {
      setIsRecovering(true);

      // Try to get existing active session
      const { data: existingSessions, error: sessionError } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('symbol', symbol)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1);

      if (sessionError) {
        console.error('[Supabase] Error fetching sessions:', sessionError);
        return null;
      }

      if (existingSessions && existingSessions.length > 0) {
        const existingSession = existingSessions[0] as TradingSession;
        console.log(`[Supabase] 🔄 Recovering existing session: ${existingSession.id}`);
        
        // Recover positions
        const { data: positions, error: positionsError } = await supabase
          .from('positions')
          .select('*')
          .eq('session_id', existingSession.id)
          .order('entry_time', { ascending: false });

        if (positionsError) {
          console.error('[Supabase] Error fetching positions:', positionsError);
        }

        // Get latest portfolio snapshot
        const { data: snapshots, error: snapshotError } = await supabase
          .from('portfolio_snapshots')
          .select('*')
          .eq('session_id', existingSession.id)
          .order('snapshot_time', { ascending: false })
          .limit(1);

        if (snapshotError) {
          console.error('[Supabase] Error fetching snapshots:', snapshotError);
        }

        const latestSnapshot = snapshots?.[0];

        // Convert database positions to trading system format
        const convertedPositions: Position[] = (positions || []).map(dbPos => ({
          id: dbPos.external_id,
          symbol: dbPos.symbol,
          side: dbPos.side as 'BUY' | 'SELL',
          size: dbPos.size,
          entryPrice: dbPos.entry_price,
          currentPrice: dbPos.current_price,
          unrealizedPnL: dbPos.unrealized_pnl,
          realizedPnL: dbPos.realized_pnl,
          timestamp: new Date(dbPos.entry_time).getTime(),
          status: dbPos.status as 'OPEN' | 'CLOSED' | 'PENDING'
        }));

        // Reconstruct portfolio from session and snapshot data
        const recoveredPortfolio: Portfolio = {
          baseCapital: latestSnapshot?.base_capital || existingSession.initial_balance,
          availableBalance: latestSnapshot?.available_balance || existingSession.current_balance,
          lockedProfits: latestSnapshot?.locked_profits || existingSession.locked_profits,
          positions: convertedPositions,
          totalPnL: latestSnapshot?.total_pnl || existingSession.total_pnl,
          dayPnL: latestSnapshot?.day_pnl || existingSession.day_pnl,
          equity: latestSnapshot?.equity || existingSession.equity
        };

        setCurrentSession(existingSession);
        setRecoveredData({
          portfolio: recoveredPortfolio,
          positions: convertedPositions
        });

        console.log(`[Supabase] ✅ Session recovered with ${convertedPositions.length} positions, Equity: ${recoveredPortfolio.equity.toFixed(2)}`);
        return existingSession;
      }

      // Create new session
      console.log('[Supabase] 🆕 Creating new trading session');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[Supabase] No user found for session creation');
        return null;
      }

      const { data: newSession, error: createError } = await supabase
        .from('trading_sessions')
        .insert({
          user_id: user.id,
          symbol: symbol,
          start_time: new Date().toISOString(),
          status: 'active',
          initial_balance: initialPortfolio.baseCapital,
          current_balance: initialPortfolio.availableBalance,
          locked_profits: initialPortfolio.lockedProfits,
          total_pnl: initialPortfolio.totalPnL,
          day_pnl: initialPortfolio.dayPnL,
          equity: initialPortfolio.equity,
          config: tradingConfig
        })
        .select()
        .single();

      if (createError) {
        console.error('[Supabase] Error creating session:', createError);
        return null;
      }

      if (newSession) {
        setCurrentSession(newSession as TradingSession);
        console.log(`[Supabase] ✅ New session created: ${newSession.id}`);
      }

      return newSession as TradingSession;
    } catch (error) {
      console.error('[Supabase] Error initializing session:', error);
      return null;
    } finally {
      setIsRecovering(false);
    }
  }, [symbol, isAuthenticated]);

  // Save portfolio state
  const savePortfolioState = useCallback(async (portfolio: Portfolio) => {
    if (!currentSession || !isAuthenticated) return;

    // Debounce saves to avoid too many database calls
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Only save if data has changed
        const currentData = JSON.stringify({
          balance: portfolio.availableBalance,
          equity: portfolio.equity,
          pnl: portfolio.totalPnL,
          positions: portfolio.positions.length
        });

        if (currentData === lastSaveDataRef.current) return;
        lastSaveDataRef.current = currentData;

        // Update session with current portfolio state
        const { error } = await supabase
          .from('trading_sessions')
          .update({
            current_balance: portfolio.availableBalance,
            locked_profits: portfolio.lockedProfits,
            total_pnl: portfolio.totalPnL,
            day_pnl: portfolio.dayPnL,
            equity: portfolio.equity
          })
          .eq('id', currentSession.id);

        if (error) {
          console.error('[Supabase] Error saving portfolio state:', error);
        } else {
          console.log(`[Supabase] 💾 Portfolio state saved - Equity: ${portfolio.equity.toFixed(2)}`);
        }
      } catch (error) {
        console.error('[Supabase] Error saving portfolio state:', error);
      }
    }, 1000); // 1 second debounce
  }, [currentSession, isAuthenticated]);

  // Save position
  const savePosition = useCallback(async (position: Position) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      const { error } = await supabase
        .from('positions')
        .insert({
          session_id: currentSession.id,
          external_id: position.id,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entry_price: position.entryPrice,
          current_price: position.currentPrice,
          unrealized_pnl: position.unrealizedPnL,
          realized_pnl: position.realizedPnL,
          entry_time: new Date(position.timestamp).toISOString(),
          status: position.status
        });

      if (error) {
        console.error('[Supabase] Error saving position:', error);
      } else {
        console.log(`[Supabase] 📍 Position saved: ${position.side} ${position.symbol}`);
      }
    } catch (error) {
      console.error('[Supabase] Error saving position:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Update position
  const updatePosition = useCallback(async (positionId: string, updates: Partial<Position>) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      const dbUpdates: any = {};
      if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
      if (updates.unrealizedPnL !== undefined) dbUpdates.unrealized_pnl = updates.unrealizedPnL;
      if (updates.realizedPnL !== undefined) dbUpdates.realized_pnl = updates.realizedPnL;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabase
        .from('positions')
        .update(dbUpdates)
        .eq('session_id', currentSession.id)
        .eq('external_id', positionId);

      if (error) {
        console.error('[Supabase] Error updating position:', error);
      }
    } catch (error) {
      console.error('[Supabase] Error updating position:', error);
    }
  }, [currentSession, isAuthenticated]);

  // Save signal with proper type handling
  const saveSignal = useCallback(async (signal: TradingSignal, prediction?: any, marketContext?: MarketContext, indicators?: AdvancedIndicators) => {
    if (!currentSession || !isAuthenticated) return null;

    try {
      const signalData = {
        session_id: currentSession.id,
        symbol: signal.symbol,
        action: signal.action,
        confidence: signal.confidence,
        price: signal.price,
        quantity: signal.quantity,
        signal_time: new Date(signal.timestamp).toISOString(),
        reasoning: signal.reasoning,
        prediction_data: prediction,
        market_context: marketContext,
        indicators: indicators
      };

      // Use .insert() with proper type casting
      const { data, error } = await supabase
        .from('trading_signals')
        .insert(signalData as any)
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Error saving signal:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Supabase] Error saving signal:', error);
      return null;
    }
  }, [currentSession, isAuthenticated]);

  // Take portfolio snapshot with proper type handling
  const takePortfolioSnapshot = useCallback(async (portfolio: Portfolio, marketContext?: MarketContext, indicators?: AdvancedIndicators) => {
    if (!currentSession || !isAuthenticated) return;

    try {
      const snapshotData = {
        session_id: currentSession.id,
        snapshot_time: new Date().toISOString(),
        base_capital: portfolio.baseCapital,
        available_balance: portfolio.availableBalance,
        locked_profits: portfolio.lockedProfits,
        total_pnl: portfolio.totalPnL,
        day_pnl: portfolio.dayPnL,
        equity: portfolio.equity,
        market_context: marketContext,
        indicators: indicators
      };

      // Use .insert() with proper type casting
      const { error } = await supabase
        .from('portfolio_snapshots')
        .insert(snapshotData as any);

      if (error) {
        console.error('[Supabase] Error taking portfolio snapshot:', error);
      } else {
        console.log(`[Supabase] 📸 Portfolio snapshot taken`);
      }
    } catch (error) {
      console.error('[Supabase] Error taking portfolio snapshot:', error);
    }
  }, [currentSession, isAuthenticated]);

  // End session
  const endSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      const { error } = await supabase
        .from('trading_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', currentSession.id);

      if (error) {
        console.error('[Supabase] Error ending session:', error);
      } else {
        setCurrentSession(null);
        setRecoveredData(null);
        console.log(`[Supabase] 🛑 Session ended: ${currentSession.id}`);
      }
    } catch (error) {
      console.error('[Supabase] Error ending session:', error);
    }
  }, [currentSession]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!currentSession || !isAuthenticated) return;

    const channel = supabase
      .channel('trading-session-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'positions',
          filter: `session_id=eq.${currentSession.id}`,
        },
        (payload) => {
          console.log('[Supabase] Position change:', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trading_signals',
          filter: `session_id=eq.${currentSession.id}`,
        },
        (payload) => {
          console.log('[Supabase] Signal change:', payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSession, isAuthenticated]);

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
