
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SystemHealthCheck } from '@/services/supabaseTradingService';
import { useToast } from '@/hooks/use-toast';

export const useSystemHealth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: healthData = [], refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemHealthCheck[]> => {
      console.log('[System Health] 🔍 Fetching system health data');
      
      const { data, error } = await supabase
        .rpc('trading_system_health_check');

      if (error) {
        console.error('[System Health] ❌ Error fetching health data:', error);
        throw error;
      }

      console.log('[System Health] ✅ Health data fetched:', data);
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const performCleanup = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('[System Health] 🧹 Performing system cleanup');
      
      const { error } = await supabase.rpc('cleanup_old_sessions');
      
      if (error) {
        console.error('[System Health] ❌ Cleanup error:', error);
        toast({
          title: "Cleanup Failed",
          description: "Failed to perform system cleanup",
          variant: "destructive",
        });
        return;
      }

      console.log('[System Health] ✅ System cleanup completed');
      toast({
        title: "Cleanup Completed",
        description: "System cleanup performed successfully",
      });

      // Refresh health data after cleanup
      refetch();
    } catch (error) {
      console.error('[System Health] ❌ Cleanup failed:', error);
      toast({
        title: "Cleanup Error",
        description: "An error occurred during cleanup",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, refetch]);

  const performReset = useCallback(async (sessionId?: string) => {
    if (!sessionId) {
      console.warn('[System Health] ⚠️ No session ID provided for reset');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[System Health] 🔄 Performing system reset for session:', sessionId);
      
      const { error } = await supabase.rpc('reset_session_completely', { 
        p_session_id: sessionId 
      });
      
      if (error) {
        console.error('[System Health] ❌ Reset error:', error);
        toast({
          title: "Reset Failed",
          description: "Failed to reset session",
          variant: "destructive",
        });
        return;
      }

      console.log('[System Health] ✅ System reset completed');
      toast({
        title: "Reset Completed",
        description: "Session reset performed successfully",
      });

      // Refresh health data after reset
      refetch();
    } catch (error) {
      console.error('[System Health] ❌ Reset failed:', error);
      toast({
        title: "Reset Error",
        description: "An error occurred during reset",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, refetch]);

  return {
    healthData,
    isLoading,
    performCleanup,
    performReset,
    refetch
  };
};
