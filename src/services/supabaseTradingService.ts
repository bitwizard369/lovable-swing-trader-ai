
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

      if (error) throw error;

      return {
        ...data,
        status: data.status as 'active' | 'paused' | 'stopped'
      } as TradingSession;
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

      return {
        ...data,
        status: data.status as 'active' | 'paused' | 'stopped'
      } as TradingSession;
    } catch (error) {
      console.error('Error updating trading session:', error);
      return null;
    }
  }

  async getActiveTradingSession(symbol: string): Promise<TradingSession | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('trading_sessions')
        .select()
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data ? {
        ...data,
        status: data.status as 'active' | 'paused' | 'stopped'
      } as TradingSession : null;
    } catch (error) {
      console.error('Error getting active trading session:', error);
      return null;
    }
  }

  async savePosition(sessionId: string, position: Position): Promise<DatabasePosition | null> {
    try {
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
          entry_time: new Date(position.timestamp).toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        side: data.side as 'BUY' | 'SELL',
        status: data.status as 'OPEN' | 'CLOSED' | 'PENDING'
      } as DatabasePosition;
    } catch (error) {
      console.error('Error saving position:', error);
      return null;
    }
  }

  async updatePosition(sessionId: string, positionId: string, updates: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('positions')
        .update(updates)
        .eq('session_id', sessionId)
        .eq('external_id', positionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating position:', error);
    }
  }

  async getPositions(sessionId: string): Promise<DatabasePosition[]> {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select()
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(position => ({
        ...position,
        side: position.side as 'BUY' | 'SELL',
        status: position.status as 'OPEN' | 'CLOSED' | 'PENDING'
      })) as DatabasePosition[];
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

      if (error) throw error;

      return {
        ...data,
        action: data.action as 'BUY' | 'SELL' | 'HOLD'
      } as DatabaseSignal;
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

      if (error) throw error;
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
      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('trading_sessions')
        .select()
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get positions
      const positions = await this.getPositions(sessionId);

      // Get last snapshot
      const { data: snapshotData } = await supabase
        .from('portfolio_snapshots')
        .select()
        .eq('session_id', sessionId)
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .single();

      return {
        session: {
          ...sessionData,
          status: sessionData.status as 'active' | 'paused' | 'stopped'
        } as TradingSession,
        positions,
        lastSnapshot: snapshotData
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

      if (error) throw error;
    } catch (error) {
      console.error('Error ending trading session:', error);
    }
  }
}

export const tradingService = new SupabaseTradingService();
