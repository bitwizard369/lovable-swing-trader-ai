
import { supabase } from '@/integrations/supabase/client';

export interface CleanupResult {
  action: string;
  affected_count: number;
  details: string;
}

export interface ValidationResult {
  check_name: string;
  status: string;
  count_found: number;
  description: string;
}

export class DatabaseCleanupService {
  
  // Run emergency cleanup for old positions and sessions
  static async runEmergencyCleanup(): Promise<CleanupResult[]> {
    try {
      const { data, error } = await supabase.rpc('emergency_session_cleanup');
      
      if (error) {
        console.error('[Cleanup] Emergency cleanup failed:', error);
        throw error;
      }

      console.log('[Cleanup] ✅ Emergency cleanup completed:', data);
      return data || [];
    } catch (error) {
      console.error('[Cleanup] Error running emergency cleanup:', error);
      return [];
    }
  }

  // Close all positions for a specific session
  static async closeSessionPositions(sessionId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('emergency_close_session_positions', {
        p_session_id: sessionId
      });
      
      if (error) {
        console.error('[Cleanup] Failed to close session positions:', error);
        throw error;
      }

      console.log(`[Cleanup] ✅ Closed positions for session ${sessionId}:`, data);
      return data || [];
    } catch (error) {
      console.error('[Cleanup] Error closing session positions:', error);
      return [];
    }
  }

  // Validate trading data integrity
  static async validateDataIntegrity(): Promise<ValidationResult[]> {
    try {
      const { data, error } = await supabase.rpc('validate_trading_data_integrity');
      
      if (error) {
        console.error('[Cleanup] Data validation failed:', error);
        throw error;
      }

      console.log('[Cleanup] 📊 Data integrity validation results:', data);
      
      // Log any warnings or errors found
      if (data) {
        data.forEach((result: ValidationResult) => {
          if (result.status === 'ERROR') {
            console.error(`[Cleanup] ❌ Data integrity error - ${result.check_name}: ${result.description} (${result.count_found} found)`);
          } else if (result.status === 'WARNING') {
            console.warn(`[Cleanup] ⚠️ Data integrity warning - ${result.check_name}: ${result.description} (${result.count_found} found)`);
          }
        });
      }

      return data || [];
    } catch (error) {
      console.error('[Cleanup] Error validating data integrity:', error);
      return [];
    }
  }

  // Comprehensive system health check and cleanup
  static async performSystemHealthCheck(): Promise<{
    cleanup: CleanupResult[];
    validation: ValidationResult[];
    healthy: boolean;
  }> {
    console.log('[Cleanup] 🔍 Starting system health check...');
    
    // Run cleanup first
    const cleanup = await this.runEmergencyCleanup();
    
    // Then validate data integrity
    const validation = await this.validateDataIntegrity();
    
    // Determine if system is healthy
    const hasErrors = validation.some(result => result.status === 'ERROR');
    const healthy = !hasErrors;
    
    console.log(`[Cleanup] 📋 System health check completed - Status: ${healthy ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`);
    
    return {
      cleanup,
      validation,
      healthy
    };
  }
}
