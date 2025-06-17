
-- Create trading sessions table
CREATE TABLE public.trading_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
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
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT NOT NULL, -- The original position ID from the trading system
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  size DECIMAL(15,8) NOT NULL,
  entry_price DECIMAL(15,2) NOT NULL,
  current_price DECIMAL(15,2) NOT NULL,
  unrealized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  realized_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'PENDING')),
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

-- Create portfolio snapshots table for historical tracking
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE NOT NULL,
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
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE NOT NULL,
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
  session_id UUID REFERENCES public.trading_sessions(id) ON DELETE CASCADE NOT NULL,
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

-- RLS Policies for trading_sessions
CREATE POLICY "Users can view their own trading sessions" 
  ON public.trading_sessions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trading sessions" 
  ON public.trading_sessions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trading sessions" 
  ON public.trading_sessions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trading sessions" 
  ON public.trading_sessions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for positions
CREATE POLICY "Users can view positions from their sessions" 
  ON public.positions 
  FOR SELECT 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create positions for their sessions" 
  ON public.positions 
  FOR INSERT 
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update positions from their sessions" 
  ON public.positions 
  FOR UPDATE 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete positions from their sessions" 
  ON public.positions 
  FOR DELETE 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for portfolio_snapshots
CREATE POLICY "Users can view snapshots from their sessions" 
  ON public.portfolio_snapshots 
  FOR SELECT 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots for their sessions" 
  ON public.portfolio_snapshots 
  FOR INSERT 
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for trading_signals
CREATE POLICY "Users can view signals from their sessions" 
  ON public.trading_signals 
  FOR SELECT 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create signals for their sessions" 
  ON public.trading_signals 
  FOR INSERT 
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update signals from their sessions" 
  ON public.trading_signals 
  FOR UPDATE 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for performance_metrics
CREATE POLICY "Users can view metrics from their sessions" 
  ON public.performance_metrics 
  FOR SELECT 
  USING (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create metrics for their sessions" 
  ON public.performance_metrics 
  FOR INSERT 
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.trading_sessions WHERE user_id = auth.uid()
    )
  );

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

-- Create indexes for better performance
CREATE INDEX idx_trading_sessions_user_id ON public.trading_sessions(user_id);
CREATE INDEX idx_trading_sessions_status ON public.trading_sessions(status);
CREATE INDEX idx_positions_session_id ON public.positions(session_id);
CREATE INDEX idx_positions_status ON public.positions(status);
CREATE INDEX idx_positions_external_id ON public.positions(external_id);
CREATE INDEX idx_portfolio_snapshots_session_id ON public.portfolio_snapshots(session_id);
CREATE INDEX idx_portfolio_snapshots_time ON public.portfolio_snapshots(snapshot_time);
CREATE INDEX idx_trading_signals_session_id ON public.trading_signals(session_id);
CREATE INDEX idx_trading_signals_time ON public.trading_signals(signal_time);
CREATE INDEX idx_performance_metrics_session_id ON public.performance_metrics(session_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_trading_sessions_updated_at BEFORE UPDATE ON public.trading_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
