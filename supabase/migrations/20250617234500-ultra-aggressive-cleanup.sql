
-- Ultra-aggressive cleanup - close positions older than 15 seconds
UPDATE public.positions 
SET 
  status = 'CLOSED',
  exit_time = now(),
  updated_at = now()
WHERE status = 'OPEN' 
  AND entry_time < (now() - INTERVAL '15 seconds'); -- Ultra aggressive cleanup

-- Update cleanup function to be ultra-aggressive
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions() RETURNS VOID AS $$
BEGIN
  -- Close all positions in sessions older than 30 minutes (very aggressive)
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update session-specific cleanup to be ultra-aggressive
CREATE OR REPLACE FUNCTION public.cleanup_session_positions(p_session_id UUID) RETURNS VOID AS $$
BEGIN
  -- Close all old open positions in the specific session (ultra aggressive - 15 seconds)
  UPDATE public.positions 
  SET 
    status = 'CLOSED',
    exit_time = now(),
    updated_at = now()
  WHERE session_id = p_session_id 
    AND status = 'OPEN'
    AND entry_time < (now() - INTERVAL '15 seconds'); -- Ultra aggressive cleanup
    
  RAISE LOG 'Cleaned up old positions for session %', p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update validation to be ultra-aggressive
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
    AND entry_time < (now() - INTERVAL '15 seconds'); -- Ultra aggressive detection
  
  -- Auto-cleanup old positions immediately
  IF old_open_count > 0 THEN
    UPDATE public.positions 
    SET 
      status = 'CLOSED',
      exit_time = now(),
      updated_at = now()
    WHERE session_id = p_session_id 
      AND status = 'OPEN' 
      AND entry_time < (now() - INTERVAL '15 seconds');
      
    status_text := FORMAT('CLEANED: Auto-closed %s old open positions', old_open_count);
    
    -- Recalculate after cleanup
    SELECT COUNT(*) INTO open_count 
    FROM public.positions 
    WHERE session_id = p_session_id AND status = 'OPEN';
  ELSIF open_count > 5 THEN -- Much lower threshold
    status_text := 'WARNING: High number of open positions detected';
  ELSE
    status_text := 'OK: Session positions look normal';
  END IF;
  
  RETURN QUERY SELECT total_positions, open_count, old_open_positions, status_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
