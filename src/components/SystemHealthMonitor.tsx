
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw, Settings, Brain, Database } from 'lucide-react';
import { SystemHealthCheck } from '@/services/supabaseTradingService';

interface SystemHealthMonitorProps {
  healthData: SystemHealthCheck[];
  onCleanup?: () => void;
  onReset?: () => void;
  onResetAIModel?: () => void;
  onSyncDatabase?: () => void;
  isLoading?: boolean;
}

export const SystemHealthMonitor: React.FC<SystemHealthMonitorProps> = ({
  healthData,
  onCleanup,
  onReset,
  onResetAIModel,
  onSyncDatabase,
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
  const hasCleanupNeeded = healthData.some(metric => metric.status === 'CLEANUP_NEEDED');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">System Health & AI Model</CardTitle>
          <div className="flex gap-2">
            {hasCleanupNeeded && onCleanup && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCleanup}
                disabled={isLoading}
                className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 border-red-200"
                title="Clean up stale positions and sessions"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Cleanup
              </Button>
            )}
            {onResetAIModel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResetAIModel}
                disabled={isLoading}
                className="h-7 px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200"
                title="Reset AI model state and clear session data"
              >
                <Brain className="w-3 h-3 mr-1" />
                Reset AI
              </Button>
            )}
            {onSyncDatabase && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSyncDatabase}
                disabled={isLoading}
                className="h-7 px-2 text-xs bg-purple-50 hover:bg-purple-100 border-purple-200"
                title="Sync AI model with latest database trades"
              >
                <Database className="w-3 h-3 mr-1" />
                Sync DB
              </Button>
            )}
            {onReset && (
              <Button
                size="sm"
                variant="outline"
                onClick={onReset}
                disabled={isLoading}
                className="h-7 px-2 text-xs"
                title="Reset entire session and close all positions"
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
            
            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-xs text-blue-800 font-medium mb-1">AI Model & Stability Controls</div>
              <div className="text-xs text-blue-600 space-y-1">
                <div>• <strong>Reset AI:</strong> Clears model state and resets session data</div>
                <div>• <strong>Sync DB:</strong> Re-trains model with latest trade history</div>
                <div>• <strong>Cleanup:</strong> Removes stale positions to prevent crashes</div>
                <div>• <strong>Use when:</strong> Total trades count appears stuck or system becomes unresponsive</div>
              </div>
            </div>

            {hasIssues && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-xs text-amber-800 font-medium mb-1">⚠️ System Issues Detected</div>
                <div className="text-xs text-amber-700">
                  {hasCleanupNeeded ? 'Stale data found - cleanup recommended to prevent crashes' : 'System warnings detected - monitor closely'}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
