
-- Clean up old positions that should be closed (older than 24 hours and still OPEN)
UPDATE public.positions 
SET 
  status = 'CLOSED',
  exit_time = now(),
  updated_at = now()
WHERE status = 'OPEN' 
  AND entry_time < (now() - INTERVAL '24 hours');

-- Add a function to properly close positions with all required fields
CREATE OR REPLACE FUNCTION public.close_position_complete(
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
    unrealized_pnl = 0,
    updated_at = now()
  WHERE session_id = p_session_id 
    AND external_id = p_external_id 
    AND status = 'OPEN';
    
  -- Log the closure for debugging
  INSERT INTO public.trading_signals (
    session_id,
    symbol,
    action,
    confidence,
    price,
    quantity,
    reasoning,
    executed,
    position_id,
    signal_time
  ) 
  SELECT 
    p_session_id,
    symbol,
    'SELL',
    1.0,
    p_exit_price,
    size,
    'Position closed via close_position_complete function',
    true,
    id,
    now()
  FROM public.positions 
  WHERE session_id = p_session_id 
    AND external_id = p_external_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to clean up old sessions and their positions
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions() RETURNS VOID AS $$
BEGIN
  -- Close all positions in sessions older than 48 hours
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    updated_at = now()
  WHERE session_id IN (
    SELECT id FROM public.trading_sessions 
    WHERE created_at < (now() - INTERVAL '48 hours')
    AND status = 'active'
  ) AND status = 'OPEN';
  
  -- End old sessions
  UPDATE public.trading_sessions 
  SET 
    status = 'stopped',
    end_time = now(),
    updated_at = now()
  WHERE created_at < (now() - INTERVAL '48 hours')
    AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add validation function for session recovery
CREATE OR REPLACE FUNCTION public.validate_session_positions(p_session_id UUID)
RETURNS TABLE (
  position_count INTEGER,
  open_positions INTEGER,
  old_open_positions INTEGER,
  validation_status TEXT
) AS $$
DECLARE
  total_positions INTEGER;
  open_count INTEGER;
  old_open_count INTEGER;
  status_text TEXT;
BEGIN
  SELECT COUNT(*) INTO total_positions 
  FROM public.positions 
  WHERE session_id = p_session_id;
  
  SELECT COUNT(*) INTO open_count 
  FROM public.positions 
  WHERE session_id = p_session_id AND status = 'OPEN';
  
  SELECT COUNT(*) INTO old_open_count 
  FROM public.positions 
  WHERE session_id = p_session_id 
    AND status = 'OPEN' 
    AND entry_time < (now() - INTERVAL '1 hour');
  
  IF old_open_count > 0 THEN
    status_text := 'WARNING: Found old open positions that may need cleanup';
  ELSIF open_count > 50 THEN
    status_text := 'WARNING: High number of open positions detected';
  ELSE
    status_text := 'OK: Session positions look normal';
  END IF;
  
  RETURN QUERY SELECT total_positions, open_count, old_open_count, status_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
