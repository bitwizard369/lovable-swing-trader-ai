
-- Enhanced session cleanup function with better error handling
CREATE OR REPLACE FUNCTION public.emergency_session_cleanup()
RETURNS TABLE(
  action text,
  affected_count integer,
  details text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_positions_count integer;
  orphaned_signals_count integer;
  old_sessions_count integer;
BEGIN
  -- Close positions older than 10 minutes automatically
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = current_price,
    realized_pnl = unrealized_pnl,
    unrealized_pnl = 0,
    updated_at = now()
  WHERE status = 'OPEN'
    AND entry_time < (now() - INTERVAL '10 minutes');
  
  GET DIAGNOSTICS old_positions_count = ROW_COUNT;
  
  -- Clean up orphaned signals
  DELETE FROM public.trading_signals 
  WHERE position_id IS NOT NULL 
    AND position_id NOT IN (SELECT id FROM public.positions);
  
  GET DIAGNOSTICS orphaned_signals_count = ROW_COUNT;
  
  -- End old active sessions
  UPDATE public.trading_sessions 
  SET 
    status = 'stopped',
    end_time = now(),
    updated_at = now()
  WHERE created_at < (now() - INTERVAL '1 hour')
    AND status = 'active';
  
  GET DIAGNOSTICS old_sessions_count = ROW_COUNT;
  
  -- Return cleanup results
  RETURN QUERY VALUES 
    ('closed_old_positions', old_positions_count, 'Positions older than 10 minutes'),
    ('removed_orphaned_signals', orphaned_signals_count, 'Signals referencing non-existent positions'),
    ('ended_old_sessions', old_sessions_count, 'Sessions older than 1 hour');
END;
$$;

-- Function to safely close all positions for a specific session
CREATE OR REPLACE FUNCTION public.emergency_close_session_positions(p_session_id uuid)
RETURNS TABLE(
  position_id uuid,
  external_id text,
  symbol text,
  side text,
  pnl numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Close all open positions for the session
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    exit_price = current_price,
    realized_pnl = unrealized_pnl,
    unrealized_pnl = 0,
    updated_at = now()
  WHERE session_id = p_session_id 
    AND status = 'OPEN';
  
  -- Return details of closed positions
  RETURN QUERY
  SELECT 
    p.id,
    p.external_id,
    p.symbol,
    p.side,
    p.realized_pnl,
    p.status
  FROM public.positions p
  WHERE p.session_id = p_session_id 
    AND p.exit_time > (now() - INTERVAL '1 minute');
END;
$$;

-- Function to validate data integrity (fixed version)
CREATE OR REPLACE FUNCTION public.validate_trading_data_integrity()
RETURNS TABLE(
  check_name text,
  status text,
  count_found integer,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check for positions without valid sessions
  RETURN QUERY
  SELECT 
    'orphaned_positions'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::text,
    COUNT(*)::integer,
    'Positions without valid trading sessions'::text
  FROM public.positions p
  LEFT JOIN public.trading_sessions ts ON p.session_id = ts.id
  WHERE ts.id IS NULL;
  
  -- Check for very old open positions (fixed column reference)
  RETURN QUERY
  SELECT 
    'old_open_positions'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::text,
    COUNT(*)::integer,
    'Open positions older than 1 hour'::text
  FROM public.positions p
  WHERE p.status = 'OPEN' 
    AND p.entry_time < (now() - INTERVAL '1 hour');
  
  -- Check for sessions without user_id
  RETURN QUERY
  SELECT 
    'sessions_without_user'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::text,
    COUNT(*)::integer,
    'Trading sessions without user_id'::text
  FROM public.trading_sessions ts
  WHERE ts.user_id IS NULL;
  
  -- Check for negative balances
  RETURN QUERY
  SELECT 
    'negative_balances'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::text,
    COUNT(*)::integer,
    'Sessions with negative current balance'::text
  FROM public.trading_sessions ts
  WHERE ts.current_balance < 0;
END;
$$;

-- Add improved indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_positions_session_status ON public.positions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_entry_time ON public.positions(entry_time);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_status ON public.trading_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_trading_signals_session_time ON public.trading_signals(session_id, signal_time);

-- Run initial cleanup and validation
SELECT * FROM public.emergency_session_cleanup();
SELECT * FROM public.validate_trading_data_integrity();
