
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { DatabaseCleanupService, CleanupResult, ValidationResult } from '@/services/databaseCleanupService';

interface SystemHealthMonitorProps {
  onHealthChange?: (healthy: boolean) => void;
}

export const SystemHealthMonitor = ({ onHealthChange }: SystemHealthMonitorProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [healthStatus, setHealthStatus] = useState<{
    healthy: boolean;
    cleanup: CleanupResult[];
    validation: ValidationResult[];
  } | null>(null);

  const performHealthCheck = async () => {
    setIsLoading(true);
    try {
      console.log('[System Health] 🔍 PRODUCTION: Starting comprehensive health check...');
      const result = await DatabaseCleanupService.performSystemHealthCheck();
      
      // Enhanced production validation
      const criticalErrors = result.validation.filter(v => v.status === 'ERROR');
      const dataIntegrityIssues = result.validation.filter(v => v.count_found > 0);
      
      // More strict health assessment for production
      const isProductionHealthy = criticalErrors.length === 0 && 
                                  dataIntegrityIssues.length <= 1; // Allow max 1 minor issue
      
      console.log(`[System Health] 📊 PRODUCTION Assessment:`);
      console.log(`  - Critical Errors: ${criticalErrors.length}`);
      console.log(`  - Data Issues: ${dataIntegrityIssues.length}`);
      console.log(`  - Overall Health: ${isProductionHealthy ? 'HEALTHY' : 'ISSUES_DETECTED'}`);
      
      setHealthStatus({
        ...result,
        healthy: isProductionHealthy
      });
      setLastCheck(new Date());
      onHealthChange?.(isProductionHealthy);
    } catch (error) {
      console.error('[System Health] ❌ PRODUCTION: Health check failed:', error);
      setHealthStatus({
        healthy: false,
        cleanup: [],
        validation: []
      });
      onHealthChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Run initial health check immediately
    performHealthCheck();
    
    // Set up periodic health checks for production (every 30 seconds)
    const interval = setInterval(performHealthCheck, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'bg-green-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'ERROR': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
    );
  };

  const criticalIssues = healthStatus?.validation.filter(v => v.status === 'ERROR') || [];
  const hasDataIssues = healthStatus?.validation.some(v => v.count_found > 0) || false;

  return (
    <Card className={`w-full ${!healthStatus?.healthy ? 'border-red-300' : 'border-green-300'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <div>
            System Health
            <Badge variant="destructive" className="ml-2 text-xs">PRODUCTION</Badge>
          </div>
        </CardTitle>
        <div className="flex items-center gap-2">
          {healthStatus && getStatusIcon(healthStatus.healthy)}
          {criticalIssues.length > 0 && (
            <AlertCircle className="h-4 w-4 text-red-500 animate-pulse" />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={performHealthCheck}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Critical Alert */}
          {criticalIssues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <div className="flex items-center gap-2 text-red-800 font-semibold text-xs">
                <AlertCircle className="h-3 w-3" />
                CRITICAL SYSTEM ISSUES
              </div>
              <div className="text-xs text-red-700 mt-1">
                {criticalIssues.length} critical error(s) detected. Trading may be compromised.
              </div>
            </div>
          )}

          {/* Overall Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Production Status:</span>
            <Badge variant={healthStatus?.healthy ? "default" : "destructive"}>
              {healthStatus?.healthy ? 'OPERATIONAL' : 'ISSUES DETECTED'}
            </Badge>
          </div>

          {/* Auto-refresh Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Auto-monitor:</span>
            <Badge variant="outline" className="text-xs">
              Every 30s
            </Badge>
          </div>

          {/* Last Check */}
          {lastCheck && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Check:</span>
              <span className="text-xs font-mono">{lastCheck.toLocaleTimeString()}</span>
            </div>
          )}

          {/* Recent Cleanup Results */}
          {healthStatus?.cleanup && healthStatus.cleanup.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Recent Maintenance:</h4>
              <div className="space-y-1">
                {healthStatus.cleanup.slice(0, 3).map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{result.details}</span>
                    <Badge variant={result.affected_count > 0 ? "secondary" : "outline"} className="ml-2">
                      {result.affected_count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Integrity Status */}
          {healthStatus?.validation && healthStatus.validation.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Data Integrity:</h4>
              <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                {healthStatus.validation.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{result.description}</span>
                    <div className="flex items-center gap-1">
                      {result.count_found > 0 && (
                        <span className={`text-xs ${result.status === 'ERROR' ? 'text-red-600 font-bold' : 'text-yellow-600'}`}>
                          {result.count_found}
                        </span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(result.status)} ${
                        result.status === 'ERROR' ? 'animate-pulse' : ''
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Production Warning */}
          {hasDataIssues && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <div className="text-xs text-yellow-800">
                ⚠️ Data inconsistencies detected. Monitor portfolio calculations closely.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
