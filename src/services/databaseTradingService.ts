
import { supabase } from '@/integrations/supabase/client';
import { Portfolio, Position, TradingSignal } from '@/types/trading';
import { PortfolioCalculator } from './portfolioCalculator';

export interface DatabaseTradingSession {
  id: string;
  user_id: string;
  symbol: string;
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
  prediction_data?: any;
  created_at: string;
  updated_at: string;
}

export class DatabaseTradingService {
  private static instance: DatabaseTradingService;
  private currentSessionId: string | null = null;
  private updateCallbacks: ((portfolio: Portfolio) => void)[] = [];

  private constructor() {}

  static getInstance(): DatabaseTradingService {
    if (!DatabaseTradingService.instance) {
      DatabaseTradingService.instance = new DatabaseTradingService();
    }
    return DatabaseTradingService.instance;
  }

  async initializeSession(symbol: string, initialBalance: number, config: any): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[DB Trading] User not authenticated');
        return null;
      }

      // Check for existing active session
      const { data: existingSessions } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('symbol', symbol)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingSessions && existingSessions.length > 0) {
        console.log('[DB Trading] 🔄 Using existing session:', existingSessions[0].id);
        this.currentSessionId = existingSessions[0].id;
        return this.currentSessionId;
      }

      // Create new session
      const { data: newSession, error } = await supabase
        .from('trading_sessions')
        .insert({
          user_id: user.id,
          symbol,
          status: 'active',
          initial_balance: initialBalance,
          current_balance: initialBalance,
          locked_profits: 0,
          total_pnl: 0,
          day_pnl: 0,
          equity: initialBalance,
          config
        })
        .select()
        .single();

      if (error) {
        console.error('[DB Trading] Error creating session:', error);
        return null;
      }

      this.currentSessionId = newSession.id;
      console.log('[DB Trading] ✅ New session created:', this.currentSessionId);
      return this.currentSessionId;
    } catch (error) {
      console.error('[DB Trading] Error initializing session:', error);
      return null;
    }
  }

  async getPortfolio(): Promise<Portfolio | null> {
    if (!this.currentSessionId) return null;

    try {
      // Get session data
      const { data: session, error: sessionError } = await supabase
        .from('trading_sessions')
        .select('*')
        .eq('id', this.currentSessionId)
        .single();

      if (sessionError || !session) {
        console.error('[DB Trading] Error fetching session:', sessionError);
        return null;
      }

      // Get positions
      const { data: positions, error: positionsError } = await supabase
        .from('positions')
        .select('*')
        .eq('session_id', this.currentSessionId)
        .order('created_at', { ascending: false });

      if (positionsError) {
        console.error('[DB Trading] Error fetching positions:', positionsError);
        return null;
      }

      // Convert database positions to Portfolio positions
      const portfolioPositions: Position[] = (positions || []).map(dbPos => ({
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

      const portfolio: Portfolio = {
        baseCapital: session.initial_balance,
        availableBalance: session.current_balance,
        lockedProfits: session.locked_profits,
        positions: portfolioPositions,
        totalPnL: session.total_pnl,
        dayPnL: session.day_pnl,
        equity: session.equity
      };

      return PortfolioCalculator.recalculatePortfolio(portfolio);
    } catch (error) {
      console.error('[DB Trading] Error getting portfolio:', error);
      return null;
    }
  }

  async addPosition(position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>): Promise<Position | null> {
    if (!this.currentSessionId) return null;

    try {
      // Check available balance
      const portfolio = await this.getPortfolio();
      if (!portfolio) return null;

      const positionValue = position.size * position.entryPrice;
      if (portfolio.availableBalance < positionValue) {
        console.error('[DB Trading] ❌ Insufficient balance for position');
        return null;
      }

      // Generate unique external ID
      const externalId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert position into database
      const { data: dbPosition, error } = await supabase
        .from('positions')
        .insert({
          session_id: this.currentSessionId,
          external_id: externalId,
          symbol: position.symbol,
          side: position.side,
          size: position.size,
          entry_price: position.entryPrice,
          current_price: position.currentPrice,
          unrealized_pnl: 0,
          realized_pnl: 0,
          status: 'OPEN',
          entry_time: new Date(position.timestamp).toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[DB Trading] Error adding position:', error);
        return null;
      }

      // Update session balance
      await supabase
        .from('trading_sessions')
        .update({
          current_balance: portfolio.availableBalance - positionValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentSessionId);

      const newPosition: Position = {
        id: externalId,
        symbol: position.symbol,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        unrealizedPnL: 0,
        realizedPnL: 0,
        timestamp: position.timestamp,
        status: 'OPEN'
      };

      console.log(`[DB Trading] ✅ Position added: ${newPosition.side} ${newPosition.size} ${newPosition.symbol}`);
      this.notifySubscribers();
      
      return newPosition;
    } catch (error) {
      console.error('[DB Trading] Error adding position:', error);
      return null;
    }
  }

  async updatePosition(positionId: string, updates: Partial<Position>): Promise<boolean> {
    if (!this.currentSessionId) return false;

    try {
      const dbUpdates: any = {};
      if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
      if (updates.unrealizedPnL !== undefined) dbUpdates.unrealized_pnl = updates.unrealizedPnL;
      if (updates.realizedPnL !== undefined) dbUpdates.realized_pnl = updates.realizedPnL;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('positions')
        .update(dbUpdates)
        .eq('session_id', this.currentSessionId)
        .eq('external_id', positionId);

      if (error) {
        console.error('[DB Trading] Error updating position:', error);
        return false;
      }

      // Update session totals if needed
      await this.updateSessionTotals();
      this.notifySubscribers();
      
      return true;
    } catch (error) {
      console.error('[DB Trading] Error updating position:', error);
      return false;
    }
  }

  async closePosition(positionId: string, closePrice: number): Promise<boolean> {
    if (!this.currentSessionId) return false;

    try {
      // Get position details
      const { data: dbPosition, error: fetchError } = await supabase
        .from('positions')
        .select('*')
        .eq('session_id', this.currentSessionId)
        .eq('external_id', positionId)
        .eq('status', 'OPEN')
        .single();

      if (fetchError || !dbPosition) {
        console.error('[DB Trading] Position not found:', fetchError);
        return false;
      }

      // Calculate realized P&L
      const realizedPnL = dbPosition.side === 'BUY'
        ? (closePrice - dbPosition.entry_price) * dbPosition.size
        : (dbPosition.entry_price - closePrice) * dbPosition.size;

      // Close position in database
      const { error: updateError } = await supabase
        .from('positions')
        .update({
          status: 'CLOSED',
          exit_time: new Date().toISOString(),
          exit_price: closePrice,
          current_price: closePrice,
          realized_pnl: realizedPnL,
          unrealized_pnl: 0,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', this.currentSessionId)
        .eq('external_id', positionId);

      if (updateError) {
        console.error('[DB Trading] Error closing position:', updateError);
        return false;
      }

      // Update session balances
      await this.updateSessionTotals();
      
      console.log(`[DB Trading] ✅ Position closed: ${positionId}, P&L: ${realizedPnL.toFixed(6)}`);
      this.notifySubscribers();
      
      return true;
    } catch (error) {
      console.error('[DB Trading] Error closing position:', error);
      return false;
    }
  }

  async saveSignal(signal: TradingSignal, prediction?: any, marketContext?: any, indicators?: any): Promise<any> {
    if (!this.currentSessionId) return null;

    try {
      const { data, error } = await supabase
        .from('trading_signals')
        .insert({
          session_id: this.currentSessionId,
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
        })
        .select()
        .single();

      if (error) {
        console.error('[DB Trading] Error saving signal:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[DB Trading] Error saving signal:', error);
      return null;
    }
  }

  private async updateSessionTotals(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      // Get all positions for the session
      const { data: positions } = await supabase
        .from('positions')
        .select('realized_pnl, unrealized_pnl, status')
        .eq('session_id', this.currentSessionId);

      if (!positions) return;

      // Calculate totals
      const totalRealizedPnL = positions
        .filter(p => p.status === 'CLOSED')
        .reduce((sum, p) => sum + p.realized_pnl, 0);

      const totalUnrealizedPnL = positions
        .filter(p => p.status === 'OPEN')
        .reduce((sum, p) => sum + p.unrealized_pnl, 0);

      const totalPnL = totalRealizedPnL + totalUnrealizedPnL;

      // Get current session to calculate equity
      const { data: session } = await supabase
        .from('trading_sessions')
        .select('initial_balance, locked_profits')
        .eq('id', this.currentSessionId)
        .single();

      if (!session) return;

      const equity = session.initial_balance + totalPnL + session.locked_profits;
      const availableBalance = equity - session.locked_profits - totalUnrealizedPnL;

      // Update session
      await supabase
        .from('trading_sessions')
        .update({
          total_pnl: totalPnL,
          equity: equity,
          current_balance: availableBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentSessionId);

    } catch (error) {
      console.error('[DB Trading] Error updating session totals:', error);
    }
  }

  async endSession(): Promise<boolean> {
    if (!this.currentSessionId) return false;

    try {
      // Close all open positions first
      await supabase.rpc('emergency_close_session_positions', {
        p_session_id: this.currentSessionId
      });

      // End the session
      const { error } = await supabase
        .from('trading_sessions')
        .update({
          status: 'stopped',
          end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentSessionId);

      if (error) {
        console.error('[DB Trading] Error ending session:', error);
        return false;
      }

      console.log(`[DB Trading] 🛑 Session ended: ${this.currentSessionId}`);
      this.currentSessionId = null;
      return true;
    } catch (error) {
      console.error('[DB Trading] Error ending session:', error);
      return false;
    }
  }

  subscribe(callback: (portfolio: Portfolio) => void): () => void {
    this.updateCallbacks.push(callback);
    
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  private async notifySubscribers(): Promise<void> {
    const portfolio = await this.getPortfolio();
    if (portfolio) {
      this.updateCallbacks.forEach(callback => {
        try {
          callback(portfolio);
        } catch (error) {
          console.error('[DB Trading] Error in subscriber callback:', error);
        }
      });
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  isUsingRealData(): boolean {
    return true; // Database is always "real" data
  }
}
