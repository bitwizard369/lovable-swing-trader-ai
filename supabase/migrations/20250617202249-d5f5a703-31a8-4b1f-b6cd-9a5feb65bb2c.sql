
-- Step 1: Clean up existing data and fix database structure
-- First, let's add proper constraints and indexes that might be missing

-- Add missing foreign key constraints
ALTER TABLE public.positions 
ADD CONSTRAINT fk_positions_session 
FOREIGN KEY (session_id) REFERENCES public.trading_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.portfolio_snapshots 
ADD CONSTRAINT fk_snapshots_session 
FOREIGN KEY (session_id) REFERENCES public.trading_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.trading_signals 
ADD CONSTRAINT fk_signals_session 
FOREIGN KEY (session_id) REFERENCES public.trading_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.performance_metrics 
ADD CONSTRAINT fk_metrics_session 
FOREIGN KEY (session_id) REFERENCES public.trading_sessions(id) ON DELETE CASCADE;

-- Add proper indexes for better performance
CREATE INDEX IF NOT EXISTS idx_positions_external_id_session ON public.positions(external_id, session_id);
CREATE INDEX IF NOT EXISTS idx_positions_status_session ON public.positions(status, session_id);
CREATE INDEX IF NOT EXISTS idx_positions_updated_at ON public.positions(updated_at);

-- Add a function to automatically update position current_price and unrealized_pnl
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

-- Add a function to close positions properly
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

-- Add a function to get active positions with real-time data
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

-- Clean up any orphaned data or inconsistent states
-- Remove positions without valid sessions
DELETE FROM public.positions 
WHERE session_id NOT IN (SELECT id FROM public.trading_sessions);

-- Remove portfolio snapshots without valid sessions  
DELETE FROM public.portfolio_snapshots 
WHERE session_id NOT IN (SELECT id FROM public.trading_sessions);

-- Remove trading signals without valid sessions
DELETE FROM public.trading_signals 
WHERE session_id NOT IN (SELECT id FROM public.trading_sessions);

-- Remove performance metrics without valid sessions
DELETE FROM public.performance_metrics 
WHERE session_id NOT IN (SELECT id FROM public.trading_sessions);

-- Update any positions with invalid status
UPDATE public.positions 
SET status = 'CLOSED', updated_at = now()
WHERE status NOT IN ('OPEN', 'CLOSED', 'PENDING');

-- Ensure all active sessions have proper status
UPDATE public.trading_sessions 
SET status = 'active', updated_at = now()
WHERE status NOT IN ('active', 'paused', 'stopped');
