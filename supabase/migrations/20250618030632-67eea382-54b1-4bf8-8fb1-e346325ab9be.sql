
-- Fix the ambiguous column reference in trading_system_health_check function
DROP FUNCTION IF EXISTS public.trading_system_health_check();

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
  WHERE trading_sessions.status = 'active'
  
  UNION ALL
  
  SELECT 
    'open_positions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 50 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.positions
  WHERE positions.status = 'OPEN'
  
  UNION ALL
  
  SELECT 
    'old_open_positions'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'CLEANUP_NEEDED' END::TEXT
  FROM public.positions
  WHERE positions.status = 'OPEN' AND entry_time < (now() - INTERVAL '5 minutes')
  
  UNION ALL
  
  SELECT 
    'total_trades'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 1000 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.positions
  WHERE positions.status = 'CLOSED'
  
  UNION ALL
  
  SELECT 
    'signals_today'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN COUNT(*) < 500 THEN 'OK' ELSE 'WARNING' END::TEXT
  FROM public.trading_signals
  WHERE signal_time > (now() - INTERVAL '24 hours');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trading_system_health_check() TO authenticated;
