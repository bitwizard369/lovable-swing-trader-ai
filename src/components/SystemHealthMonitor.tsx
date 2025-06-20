
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, Shield } from 'lucide-react';
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
      const result = await DatabaseCleanupService.performSystemHealthCheck();
      setHealthStatus(result);
      setLastCheck(new Date());
      onHealthChange?.(result.healthy);
    } catch (error) {
      console.error('Health check failed:', error);
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
    // Run initial health check
    performHealthCheck();
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
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          System Health
        </CardTitle>
        <div className="flex items-center gap-2">
          {healthStatus && getStatusIcon(healthStatus.healthy)}
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
          {/* Overall Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={healthStatus?.healthy ? "default" : "destructive"}>
              {healthStatus?.healthy ? 'Healthy' : 'Issues Detected'}
            </Badge>
          </div>

          {/* Last Check */}
          {lastCheck && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Check:</span>
              <span className="text-xs">{lastCheck.toLocaleTimeString()}</span>
            </div>
          )}

          {/* Cleanup Results */}
          {healthStatus?.cleanup && healthStatus.cleanup.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Recent Cleanup:</h4>
              <div className="space-y-1">
                {healthStatus.cleanup.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{result.details}</span>
                    <Badge variant="outline" className="ml-2">
                      {result.affected_count}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Results */}
          {healthStatus?.validation && healthStatus.validation.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Data Integrity:</h4>
              <div className="grid grid-cols-1 gap-1">
                {healthStatus.validation.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="truncate">{result.description}</span>
                    <div className="flex items-center gap-1">
                      {result.count_found > 0 && (
                        <span className="text-muted-foreground">{result.count_found}</span>
                      )}
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(result.status)}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
