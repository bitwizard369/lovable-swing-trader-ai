
-- Complete database reconstruction for trading system
-- This will drop all existing tables and rebuild them with proper structure

-- Drop all existing tables and functions in correct order
DROP TABLE IF EXISTS public.performance_metrics CASCADE;
DROP TABLE IF EXISTS public.trading_signals CASCADE;
DROP TABLE IF EXISTS public.portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS public.positions CASCADE;
DROP TABLE IF EXISTS public.trading_sessions CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.update_position_price_and_pnl(UUID, TEXT, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS public.close_position(UUID, TEXT, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS public.get_active_positions_for_session(UUID);
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Create trading sessions table (main parent table)
CREATE TABLE public.trading_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  initial_balance DECIMAL(15,2) NOT NULL,
  current_balance DECIMAL(15,2) NOT NULL,
  locked_profits DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  day_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  equity DECIMAL(15,2) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create positions table
CREATE TABLE public.positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trading_sessions(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,2) NOT NULL,
  current_price DECIMAL(15,2) NOT NULL,
  unrealized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  realized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_time TIMESTAMP WITH TIME ZONE,
  exit_price DECIMAL(15,2),
  max_favorable_excursion DECIMAL(8,4) DEFAULT 0,
  max_adverse_excursion DECIMAL(8,4) DEFAULT 0,
  trailing_stop_price DECIMAL(15,2),
  partial_profits_taken INTEGER DEFAULT 0,
  prediction_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, external_id)
);

-- Create portfolio snapshots table
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trading_sessions(id) ON DELETE CASCADE,
  snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  base_capital DECIMAL(15,2) NOT NULL,
  available_balance DECIMAL(15,2) NOT NULL,
  locked_profits DECIMAL(15,2) NOT NULL,
  total_pnl DECIMAL(15,2) NOT NULL,
  day_pnl DECIMAL(15,2) NOT NULL,
  equity DECIMAL(15,2) NOT NULL,
  open_positions_count INTEGER NOT NULL DEFAULT 0,
  market_context JSONB,
  indicators JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trading signals table
CREATE TABLE public.trading_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trading_sessions(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  confidence DECIMAL(5,4) NOT NULL,
  price DECIMAL(15,2) NOT NULL,
  quantity DECIMAL(15,8) NOT NULL,
  reasoning TEXT,
  prediction_data JSONB,
  market_context JSONB,
  indicators JSONB,
  executed BOOLEAN NOT NULL DEFAULT false,
  position_id UUID REFERENCES public.positions(id),
  signal_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create performance metrics table
CREATE TABLE public.performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trading_sessions(id) ON DELETE CASCADE,
  calculation_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  max_drawdown DECIMAL(8,4) NOT NULL DEFAULT 0,
  current_drawdown DECIMAL(8,4) NOT NULL DEFAULT 0,
  sharpe_ratio DECIMAL(8,4),
  win_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  avg_win DECIMAL(15,2) NOT NULL DEFAULT 0,
  avg_loss DECIMAL(15,2) NOT NULL DEFAULT 0,
  profit_factor DECIMAL(8,4) NOT NULL DEFAULT 0,
  total_trades INTEGER NOT NULL DEFAULT 0,
  winning_trades INTEGER NOT NULL DEFAULT 0,
  losing_trades INTEGER NOT NULL DEFAULT 0,
  model_performance JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trading_sessions
CREATE POLICY "Users can manage their own trading sessions" 
  ON public.trading_sessions 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Create RLS policies for positions
CREATE POLICY "Users can manage positions from their sessions" 
  ON public.positions 
  FOR ALL 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for portfolio_snapshots
CREATE POLICY "Users can manage snapshots from their sessions" 
  ON public.portfolio_snapshots 
  FOR ALL 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for trading_signals
CREATE POLICY "Users can manage signals from their sessions" 
  ON public.trading_signals 
  FOR ALL 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for performance_metrics
CREATE POLICY "Users can manage metrics from their sessions" 
  ON public.performance_metrics 
  FOR ALL 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- Create optimized indexes for performance
CREATE INDEX idx_trading_sessions_user_id ON public.trading_sessions(user_id);
CREATE INDEX idx_trading_sessions_status ON public.trading_sessions(status);
CREATE INDEX idx_positions_session_id ON public.positions(session_id);
CREATE INDEX idx_positions_external_id_session ON public.positions(external_id, session_id);
CREATE INDEX idx_positions_status ON public.positions(status);
CREATE INDEX idx_positions_updated_at ON public.positions(updated_at);
CREATE INDEX idx_portfolio_snapshots_session_id ON public.portfolio_snapshots(session_id);
CREATE INDEX idx_portfolio_snapshots_time ON public.portfolio_snapshots(snapshot_time);
CREATE INDEX idx_trading_signals_session_id ON public.trading_signals(session_id);
CREATE INDEX idx_trading_signals_time ON public.trading_signals(signal_time);
CREATE INDEX idx_performance_metrics_session_id ON public.performance_metrics(session_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_trading_sessions_updated_at 
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_positions_updated_at 
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optimized function to update position price and PnL
CREATE OR REPLACE FUNCTION public.update_position_price_and_pnl(
  p_session_id UUID,
  p_external_id TEXT,
  p_current_price DECIMAL,
  p_unrealized_pnl DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.positions
  SET 
    current_price = p_current_price,
    unrealized_pnl = p_unrealized_pnl,
    updated_at = now()
  WHERE session_id = p_session_id 
    AND external_id = p_external_id 
    AND status = 'OPEN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to close positions properly
CREATE OR REPLACE FUNCTION public.close_position(
  p_session_id UUID,
  p_external_id TEXT,
  p_exit_price DECIMAL,
  p_realized_pnl DECIMAL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.positions
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = p_exit_price,
    realized_pnl = p_realized_pnl,
    updated_at = now()
  WHERE session_id = p_session_id 
    AND external_id = p_external_id 
    AND status = 'OPEN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimized function to get active positions
CREATE OR REPLACE FUNCTION public.get_active_positions_for_session(p_session_id UUID)
RETURNS TABLE (
  id UUID,
  external_id TEXT,
  symbol TEXT,
  side TEXT,
  size DECIMAL,
  entry_price DECIMAL,
  current_price DECIMAL,
  unrealized_pnl DECIMAL,
  realized_pnl DECIMAL,
  status TEXT,
  entry_time TIMESTAMP WITH TIME ZONE,
  prediction_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.external_id,
    p.symbol,
    p.side,
    p.size,
    p.entry_price,
    p.current_price,
    p.unrealized_pnl,
    p.realized_pnl,
    p.status,
    p.entry_time,
    p.prediction_data,
    p.created_at,
    p.updated_at
  FROM public.positions p
  WHERE p.session_id = p_session_id 
    AND p.status = 'OPEN'
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for all tables
ALTER TABLE public.trading_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.positions REPLICA IDENTITY FULL;
ALTER TABLE public.portfolio_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.trading_signals REPLICA IDENTITY FULL;
ALTER TABLE public.performance_metrics REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_metrics;
