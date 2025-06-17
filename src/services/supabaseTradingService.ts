
import { supabase } from '@/integrations/supabase/client';
import { Position } from '@/types/trading';

// Database-specific types that match the actual Supabase schema
export interface TradingSession {
  id: string;
  user_id: string;
  symbol: string;
  start_time: string;
  end_time: string | null;
  status: 'active' | 'paused' | 'stopped';
  initial_balance: number;
  current_balance: number;
  locked_profits: number;
  total_pnl: number;
  day_pnl: number;
  equity: number;
  config: any;
  created_at: string;
  updated_at: string;
}

export interface DatabasePosition {
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
  status: 'OPEN' | 'CLOSED' | 'PENDING';
  entry_time: string;
  exit_time: string | null;
  exit_price: number | null;
  max_favorable_excursion: number | null;
  max_adverse_excursion: number | null;
  trailing_stop_price: number | null;
  partial_profits_taken: number | null;
  prediction_data: any;
  created_at: string;
  updated_at: string;
}

export interface DatabaseSignal {
  id: string;
  session_id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  quantity: number;
  reasoning: string | null;
  prediction_data: any;
  market_context: any;
  indicators: any;
  executed: boolean;
  position_id: string | null;
  signal_time: string;
  created_at: string;
}

class SupabaseTradingService {
  async createTradingSession(sessionData: Omit<TradingSession, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<TradingSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('[DB] Creating new trading session for user:', user.id);

      const { data, error } = await supabase
        .from('trading_sessions')
        .insert({
          user_id: user.id,
          symbol: sessionData.symbol,
          start_time: sessionData.start_time || new Date().toISOString(),
          status: sessionData.status,
          initial_balance: sessionData.initial_balance,
          current_balance: sessionData.current_balance,
          locked_profits: sessionData.locked_profits,
          total_pnl: sessionData.total_pnl,
          day_pnl: sessionData.day_pnl,
          equity: sessionData.equity,
          config: sessionData.config
        })
        .select()
        .single();

      if (error) {
        console.error('[DB] Error creating trading session:', error);
        throw error;
      }

      console.log('[DB] ✅ Trading session created:', data.id);
      return data as TradingSession;
    } catch (error) {
      console.error('Error creating trading session:', error);
      return null;
    }
  }

  async updateTradingSession(sessionId: string, updates: Partial<TradingSession>): Promise<TradingSession | null> {
    try {
      const { data, error } = await supabase
        .from('trading_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      return data as TradingSession;
    } catch (error) {
      console.error('Error updating trading session:', error);
      return null;
    }
  }

  async getActiveTradingSession(symbol: string): Promise<TradingSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[DB] User not authenticated');
        return null;
      }

      console.log('[DB] Looking for active session for user:', user.id, 'symbol:', symbol);

      const { data, error } = await supabase
        .from('trading_sessions')
        .select()
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('[DB] Error getting active session:', error);
        throw error;
      }

      const session = data && data.length > 0 ? data[0] as TradingSession : null;
      
      if (session) {
        console.log('[DB] ✅ Found active session:', session.id);
      } else {
        console.log('[DB] No active session found');
      }

      return session;
    } catch (error) {
      console.error('Error getting active trading session:', error);
      return null;
    }
  }

  async savePosition(sessionId: string, position: Position): Promise<DatabasePosition | null> {
    try {
      console.log(`[DB] Saving position ${position.id} to session ${sessionId}`);

      const { data, error } = await supabase
        .from('positions')
        .insert({
          session_id: sessionId,
          external_id: position.id,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entry_price: position.entryPrice,
          current_price: position.currentPrice,
          unrealized_pnl: position.unrealizedPnL,
          realized_pnl: position.realizedPnL,
          status: position.status,
          entry_time: new Date(position.timestamp).toISOString(),
          prediction_data: null
        })
        .select()
        .single();

      if (error) {
        console.error('[DB] Error saving position:', error);
        throw error;
      }

      console.log(`[DB] ✅ Position saved: ${position.id}`);
      return data as DatabasePosition;
    } catch (error) {
      console.error('Error saving position:', error);
      return null;
    }
  }

  async updatePositionPriceAndPnL(sessionId: string, positionId: string, currentPrice: number, unrealizedPnL: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_position_price_and_pnl', {
        p_session_id: sessionId,
        p_external_id: positionId,
        p_current_price: currentPrice,
        p_unrealized_pnl: unrealizedPnL
      });

      if (error) {
        console.error('[DB] Error updating position price/PnL:', error);
        throw error;
      }

      // Only log every 5th update to reduce noise
      if (Math.random() < 0.2) {
        console.log(`[DB] Position ${positionId} updated: Price=${currentPrice.toFixed(4)}, PnL=${unrealizedPnL.toFixed(2)}`);
      }
    } catch (error) {
      console.error('Error updating position price and PnL:', error);
    }
  }

  async closePosition(sessionId: string, positionId: string, exitPrice: number, realizedPnL: number): Promise<void> {
    try {
      const { error } = await supabase.rpc('close_position', {
        p_session_id: sessionId,
        p_external_id: positionId,
        p_exit_price: exitPrice,
        p_realized_pnl: realizedPnL
      });

      if (error) {
        console.error('[DB] Error closing position:', error);
        throw error;
      }

      console.log(`[DB] ✅ Position ${positionId} closed at ${exitPrice}, PnL: ${realizedPnL.toFixed(2)}`);
    } catch (error) {
      console.error('Error closing position:', error);
    }
  }

  async updatePosition(sessionId: string, positionId: string, updates: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('positions')
        .update(updates)
        .eq('session_id', sessionId)
        .eq('external_id', positionId);

      if (error) {
        console.error('[DB] Error updating position:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error updating position:', error);
    }
  }

  async getActivePositions(sessionId: string): Promise<DatabasePosition[]> {
    try {
      const { data, error } = await supabase.rpc('get_active_positions_for_session', {
        p_session_id: sessionId
      });

      if (error) {
        console.error('[DB] Error getting active positions:', error);
        throw error;
      }

      return (data || []) as DatabasePosition[];
    } catch (error) {
      console.error('Error getting active positions:', error);
      return [];
    }
  }

  async getPositions(sessionId: string): Promise<DatabasePosition[]> {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select()
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[DB] Error getting positions:', error);
        throw error;
      }

      return (data || []) as DatabasePosition[];
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  async saveSignal(sessionId: string, signal: any, prediction?: any, marketContext?: any, indicators?: any): Promise<DatabaseSignal | null> {
    try {
      const { data, error } = await supabase
        .from('trading_signals')
        .insert({
          session_id: sessionId,
          symbol: signal.symbol,
          action: signal.action,
          confidence: signal.confidence,
          price: signal.price,
          quantity: signal.quantity,
          reasoning: signal.reasoning,
          prediction_data: prediction,
          market_context: marketContext,
          indicators: indicators,
          signal_time: new Date(signal.timestamp).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[DB] Error saving signal:', error);
        throw error;
      }

      return data as DatabaseSignal;
    } catch (error) {
      console.error('Error saving signal:', error);
      return null;
    }
  }

  async savePortfolioSnapshot(sessionId: string, portfolio: any, marketContext?: any, indicators?: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('portfolio_snapshots')
        .insert({
          session_id: sessionId,
          base_capital: portfolio.baseCapital,
          available_balance: portfolio.availableBalance,
          locked_profits: portfolio.lockedProfits,
          total_pnl: portfolio.totalPnL,
          day_pnl: portfolio.dayPnL,
          equity: portfolio.equity,
          open_positions_count: portfolio.positions?.length || 0,
          market_context: marketContext,
          indicators: indicators
        });

      if (error) {
        console.error('[DB] Error saving portfolio snapshot:', error);
        throw error;
      }

      console.log('[DB] 📸 Portfolio snapshot saved');
    } catch (error) {
      console.error('Error saving portfolio snapshot:', error);
    }
  }

  async recoverTradingSession(sessionId: string): Promise<{
    session: TradingSession;
    positions: DatabasePosition[];
    lastSnapshot?: any;
  } | null> {
    try {
      console.log(`[DB] Recovering session: ${sessionId}`);

      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('trading_sessions')
        .select()
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('[DB] Error recovering session:', sessionError);
        throw sessionError;
      }

      // Get active positions using the optimized function
      const positions = await this.getActivePositions(sessionId);

      // Get last snapshot
      const { data: snapshotData } = await supabase
        .from('portfolio_snapshots')
        .select()
        .eq('session_id', sessionId)
        .order('snapshot_time', { ascending: false })
        .limit(1);

      const lastSnapshot = snapshotData && snapshotData.length > 0 ? snapshotData[0] : null;

      console.log(`[DB] ✅ Session recovered: ${positions.length} positions, ${lastSnapshot ? 'with' : 'without'} snapshot`);

      return {
        session: sessionData as TradingSession,
        positions,
        lastSnapshot
      };
    } catch (error) {
      console.error('Error recovering trading session:', error);
      return null;
    }
  }

  async endTradingSession(sessionId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('trading_sessions')
        .update({
          status: 'stopped',
          end_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        console.error('[DB] Error ending session:', error);
        throw error;
      }

      console.log(`[DB] ✅ Session ended: ${sessionId}`);
    } catch (error) {
      console.error('Error ending trading session:', error);
    }
  }
}

export const tradingService = new SupabaseTradingService();
