
import { supabase } from "@/integrations/supabase/client";

export interface TradingSession {
  id: string;
  user_id: string;
  symbol: string;
  start_time: string;
  end_time?: string;
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
  exit_time?: string;
  exit_price?: number;
  max_favorable_excursion?: number;
  max_adverse_excursion?: number;
  trailing_stop_price?: number;
  partial_profits_taken?: number;
  prediction_data?: any;
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
  reasoning?: string;
  prediction_data?: any;
  market_context?: any;
  indicators?: any;
  executed: boolean;
  position_id?: string;
  signal_time: string;
  created_at: string;
}

export interface PortfolioSnapshot {
  id: string;
  session_id: string;
  snapshot_time: string;
  base_capital: number;
  available_balance: number;
  locked_profits: number;
  total_pnl: number;
  day_pnl: number;
  equity: number;
  open_positions_count: number;
  market_context?: any;
  indicators?: any;
  created_at: string;
}

export class SupabaseTradingService {
  // Trading Sessions
  async createTradingSession(sessionData: Omit<TradingSession, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<TradingSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('trading_sessions')
      .insert({
        ...sessionData,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trading session:', error);
      return null;
    }

    console.log(`[DB] ✅ Trading session created: ${data.id}`);
    return data;
  }

  async updateTradingSession(sessionId: string, updates: Partial<TradingSession>): Promise<TradingSession | null> {
    const { data, error } = await supabase
      .from('trading_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating trading session:', error);
      return null;
    }

    return data;
  }

  async getActiveTradingSession(symbol: string): Promise<TradingSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('trading_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching active session:', error);
      return null;
    }

    return data;
  }

  async endTradingSession(sessionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('trading_sessions')
      .update({ 
        status: 'stopped',
        end_time: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) {
      console.error('Error ending trading session:', error);
      return false;
    }

    console.log(`[DB] 🛑 Trading session ended: ${sessionId}`);
    return true;
  }

  // Positions
  async savePosition(sessionId: string, position: any): Promise<DatabasePosition | null> {
    const positionData = {
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
    };

    const { data, error } = await supabase
      .from('positions')
      .upsert(positionData, { 
        onConflict: 'session_id,external_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving position:', error);
      return null;
    }

    return data;
  }

  async updatePosition(sessionId: string, positionId: string, updates: Partial<DatabasePosition>): Promise<boolean> {
    const { error } = await supabase
      .from('positions')
      .update(updates)
      .eq('session_id', sessionId)
      .eq('external_id', positionId);

    if (error) {
      console.error('Error updating position:', error);
      return false;
    }

    return true;
  }

  async getOpenPositions(sessionId: string): Promise<DatabasePosition[]> {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching open positions:', error);
      return [];
    }

    return data || [];
  }

  // Trading Signals
  async saveSignal(sessionId: string, signal: any, prediction?: any, marketContext?: any, indicators?: any): Promise<DatabaseSignal | null> {
    const signalData = {
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
      executed: false,
      signal_time: new Date(signal.timestamp).toISOString()
    };

    const { data, error } = await supabase
      .from('trading_signals')
      .insert(signalData)
      .select()
      .single();

    if (error) {
      console.error('Error saving signal:', error);
      return null;
    }

    console.log(`[DB] 📤 Signal saved: ${data.action} ${data.symbol}`);
    return data;
  }

  async markSignalExecuted(signalId: string, positionId?: string): Promise<boolean> {
    const { error } = await supabase
      .from('trading_signals')
      .update({ 
        executed: true,
        position_id: positionId 
      })
      .eq('id', signalId);

    if (error) {
      console.error('Error marking signal as executed:', error);
      return false;
    }

    return true;
  }

  // Portfolio Snapshots
  async savePortfolioSnapshot(sessionId: string, portfolio: any, marketContext?: any, indicators?: any): Promise<boolean> {
    const snapshotData = {
      session_id: sessionId,
      base_capital: portfolio.baseCapital,
      available_balance: portfolio.availableBalance,
      locked_profits: portfolio.lockedProfits,
      total_pnl: portfolio.totalPnL,
      day_pnl: portfolio.dayPnL,
      equity: portfolio.equity,
      open_positions_count: portfolio.positions.filter((p: any) => p.status === 'OPEN').length,
      market_context: marketContext,
      indicators: indicators
    };

    const { error } = await supabase
      .from('portfolio_snapshots')
      .insert(snapshotData);

    if (error) {
      console.error('Error saving portfolio snapshot:', error);
      return false;
    }

    return true;
  }

  // Performance Metrics
  async savePerformanceMetrics(sessionId: string, metrics: any): Promise<boolean> {
    const { error } = await supabase
      .from('performance_metrics')
      .insert({
        session_id: sessionId,
        ...metrics
      });

    if (error) {
      console.error('Error saving performance metrics:', error);
      return false;
    }

    return true;
  }

  // Recovery functions
  async recoverTradingSession(sessionId: string): Promise<{
    session: TradingSession;
    positions: DatabasePosition[];
    lastSnapshot?: PortfolioSnapshot;
  } | null> {
    try {
      // Get session data
      const { data: session, error: sessionError } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        console.error('Error recovering session:', sessionError);
        return null;
      }

      // Get open positions
      const positions = await this.getOpenPositions(sessionId);

      // Get last portfolio snapshot
      const { data: lastSnapshot } = await supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`[DB] 🔄 Session recovered: ${sessionId} with ${positions.length} open positions`);

      return {
        session,
        positions,
        lastSnapshot: lastSnapshot || undefined
      };
    } catch (error) {
      console.error('Error in recoverTradingSession:', error);
      return null;
    }
  }
}

export const tradingService = new SupabaseTradingService();
