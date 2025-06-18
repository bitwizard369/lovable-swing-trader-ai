
-- Deep clean and optimization of the trading system database (without cron)

-- 1. Clean up all existing data to start fresh
TRUNCATE TABLE public.trading_signals CASCADE;
TRUNCATE TABLE public.portfolio_snapshots CASCADE;
TRUNCATE TABLE public.performance_metrics CASCADE;
TRUNCATE TABLE public.positions CASCADE;
TRUNCATE TABLE public.trading_sessions CASCADE;

-- 2. Optimize the cleanup functions for better performance
DROP FUNCTION IF EXISTS public.cleanup_old_sessions();
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Close all positions in sessions older than 30 minutes
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = current_price,
    realized_pnl = unrealized_pnl,
    unrealized_pnl = 0,
    updated_at = now()
  WHERE session_id IN (
    SELECT id FROM public.trading_sessions 
    WHERE created_at < (now() - INTERVAL '30 minutes')
    AND status = 'active'
  ) AND status = 'OPEN';
  
  -- End old sessions
  UPDATE public.trading_sessions 
  SET 
    status = 'stopped',
    end_time = now(),
    updated_at = now()
  WHERE created_at < (now() - INTERVAL '30 minutes')
    AND status = 'active';
    
  RAISE LOG 'Cleaned up old sessions and positions';
END;
$$;

-- 3. Enhanced session position cleanup
DROP FUNCTION IF EXISTS public.cleanup_session_positions(uuid);
CREATE OR REPLACE FUNCTION public.cleanup_session_positions(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Close positions older than 5 minutes in the specific session
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = current_price,
    realized_pnl = unrealized_pnl,
    unrealized_pnl = 0,
    updated_at = now()
  WHERE session_id = p_session_id 
    AND status = 'OPEN'
    AND entry_time < (now() - INTERVAL '5 minutes');
    
  RAISE LOG 'Cleaned up old positions for session %', p_session_id;
END;
$$;

-- 4. Add a function to completely reset a session
CREATE OR REPLACE FUNCTION public.reset_session_completely(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Close all open positions
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = current_price,
    realized_pnl = unrealized_pnl,
    unrealized_pnl = 0,
    updated_at = now()
  WHERE session_id = p_session_id AND status = 'OPEN';
  
  -- Delete all portfolio snapshots for this session
  DELETE FROM public.portfolio_snapshots WHERE session_id = p_session_id;
  
  -- Delete all signals for this session
  DELETE FROM public.trading_signals WHERE session_id = p_session_id;
  
  -- Reset session balances
  UPDATE public.trading_sessions
  SET
    current_balance = initial_balance,
    locked_profits = 0,
    total_pnl = 0,
    day_pnl = 0,
    equity = initial_balance,
    updated_at = now()
  WHERE id = p_session_id;
  
  RAISE LOG 'Completely reset session %', p_session_id;
END;
$$;

-- 5. Enable RLS on all tables
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- 6. Add proper RLS policies
-- Trading Sessions RLS
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

-- Positions RLS
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

-- Portfolio Snapshots RLS
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

-- Trading Signals RLS
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

-- Performance Metrics RLS
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

-- 7. Optimize indexes for better performance
DROP INDEX IF EXISTS idx_positions_session_external;
CREATE INDEX idx_positions_session_external ON public.positions(session_id, external_id);

DROP INDEX IF EXISTS idx_positions_status_entry_time;
CREATE INDEX idx_positions_status_entry_time ON public.positions(status, entry_time) WHERE status = 'OPEN';

DROP INDEX IF EXISTS idx_trading_sessions_user_status;
CREATE INDEX idx_trading_sessions_user_status ON public.trading_sessions(user_id, status, created_at);

-- 8. Add a health check function
CREATE OR REPLACE FUNCTION public.trading_system_health_check()
RETURNS TABLE(
  metric TEXT,
  value BIGINT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'total_sessions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 100 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.trading_sessions
  
  UNION ALL
  
  SELECT 
    'active_sessions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 10 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.trading_sessions
  WHERE status = 'active'
  
  UNION ALL
  
  SELECT 
    'open_positions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 50 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.positions
  WHERE status = 'OPEN'
  
  UNION ALL
  
  SELECT 
    'old_open_positions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CLEANUP_NEEDED' END::TEXT
  FROM public.positions
  WHERE status = 'OPEN' AND entry_time < (now() - INTERVAL '5 minutes');
END;
$$;

-- 9. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_old_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_session_positions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_session_completely(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trading_system_health_check() TO authenticated;
