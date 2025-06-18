
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw, Settings } from 'lucide-react';
import { SystemHealthCheck } from '@/services/supabaseTradingService';

interface SystemHealthMonitorProps {
  healthData: SystemHealthCheck[];
  onCleanup?: () => void;
  onReset?: () => void;
  isLoading?: boolean;
}

export const SystemHealthMonitor: React.FC<SystemHealthMonitorProps> = ({
  healthData,
  onCleanup,
  onReset,
  isLoading = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CLEANUP_NEEDED':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle className="w-4 h-4" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4" />;
      case 'CLEANUP_NEEDED':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const hasIssues = healthData.some(metric => metric.status !== 'OK');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <div className="flex gap-2">
            {hasIssues && onCleanup && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCleanup}
                disabled={isLoading}
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Cleanup
              </Button>
            )}
            {onReset && (
              <Button
                size="sm"
                variant="outline"
                onClick={onReset}
                disabled={isLoading}
                className="h-7 px-2 text-xs"
              >
                <Settings className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {healthData.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No health data available
          </div>
        ) : (
          <div className="space-y-2">
            {healthData.map((metric, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded-lg border bg-background/50"
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(metric.status)}
                  <span className="text-sm font-medium capitalize">
                    {metric.metric.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{metric.value}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getStatusColor(metric.status)}`}
                  >
                    {metric.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
