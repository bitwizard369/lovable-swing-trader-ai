
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Activity, Database, Wifi, RefreshCw, CheckCircle, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { crashMonitor } from "@/services/crashMonitoringService";
import { RealPortfolioService } from "@/services/realPortfolioService";

interface SystemHealthDebugPanelProps {
  isConnected?: boolean;
  connectionStable?: boolean;
  latestUpdate?: any;
  updateCount?: number;
  apiHealthy?: boolean | null;
}

export const SystemHealthDebugPanel = ({
  isConnected = false,
  connectionStable = false,
  latestUpdate = null,
  updateCount = 0,
  apiHealthy = null
}: SystemHealthDebugPanelProps) => {
  const [performanceMetrics, setPerformanceMetrics] = useState(crashMonitor.getPerformanceMetrics());
  const [crashReports, setCrashReports] = useState(crashMonitor.getCrashReports());
  const [memoryUsage, setMemoryUsage] = useState<any>(null);
  const [isRealData, setIsRealData] = useState(false);
  const [systemHealth, setSystemHealth] = useState('UNKNOWN');

  useEffect(() => {
    const portfolioService = RealPortfolioService.getInstance();
    setIsRealData(portfolioService.isUsingRealData());

    const interval = setInterval(() => {
      setPerformanceMetrics(crashMonitor.getPerformanceMetrics());
      setCrashReports(crashMonitor.getCrashReports());
      
      if ('memory' in performance) {
        setMemoryUsage((performance as any).memory);
      }

      // Calculate overall system health
      const healthScore = calculateSystemHealth();
      setSystemHealth(healthScore);
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, connectionStable, apiHealthy, updateCount]);

  const calculateSystemHealth = () => {
    let score = 0;
    let maxScore = 5;

    // Connection health (20%)
    if (isConnected && connectionStable) score += 1;
    else if (isConnected) score += 0.5;

    // API health (20%)
    if (apiHealthy === true) score += 1;
    else if (apiHealthy === null) score += 0.5;

    // Data flow health (20%)
    if (updateCount > 50 && latestUpdate && (Date.now() - latestUpdate.E < 10000)) score += 1;
    else if (updateCount > 10) score += 0.5;

    // Memory health (20%)
    if (memoryUsage) {
      const memoryUsageRatio = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
      if (memoryUsageRatio < 0.5) score += 1;
      else if (memoryUsageRatio < 0.8) score += 0.5;
    } else {
      score += 0.5; // Neutral if unavailable
    }

    // Error rate health (20%)
    if (crashReports.length === 0) score += 1;
    else if (crashReports.length < 3) score += 0.5;

    const percentage = (score / maxScore) * 100;
    
    if (percentage >= 90) return 'EXCELLENT';
    if (percentage >= 75) return 'GOOD';
    if (percentage >= 50) return 'FAIR';
    if (percentage >= 25) return 'POOR';
    return 'CRITICAL';
  };

  const getHealthColor = () => {
    switch (systemHealth) {
      case 'EXCELLENT': return 'text-green-600';
      case 'GOOD': return 'text-green-500';
      case 'FAIR': return 'text-yellow-500';
      case 'POOR': return 'text-orange-500';
      case 'CRITICAL': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const clearCrashReports = () => {
    crashMonitor.resetErrorCount();
    setCrashReports([]);
    localStorage.removeItem('crashReports');
  };

  const forceRefresh = () => {
    localStorage.setItem('forceRefresh', 'true');
    window.location.reload();
  };

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const connectionAge = latestUpdate ? Math.round((Date.now() - latestUpdate.E) / 1000) : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Monitor
          </div>
          <Badge variant={systemHealth === 'EXCELLENT' || systemHealth === 'GOOD' ? 'default' : 'destructive'} 
                 className={getHealthColor()}>
            {systemHealth}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Overall System Status */}
        <div className={`p-3 rounded-lg border ${
          systemHealth === 'EXCELLENT' || systemHealth === 'GOOD' 
            ? 'bg-green-50 border-green-200' 
            : systemHealth === 'FAIR' 
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${getHealthColor()}`}>
              System Status: {systemHealth}
            </span>
            {systemHealth === 'EXCELLENT' || systemHealth === 'GOOD' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
          </div>
          <div className={`text-sm ${
            systemHealth === 'EXCELLENT' || systemHealth === 'GOOD' 
              ? 'text-green-700' 
              : systemHealth === 'FAIR'
              ? 'text-yellow-700'
              : 'text-red-700'
          }`}>
            {systemHealth === 'EXCELLENT' && 'All systems operating at peak performance'}
            {systemHealth === 'GOOD' && 'System operating normally with minor issues'}
            {systemHealth === 'FAIR' && 'System functional but performance may be degraded'}
            {systemHealth === 'POOR' && 'System experiencing significant issues'}
            {systemHealth === 'CRITICAL' && 'System requires immediate attention'}
          </div>
        </div>

        {/* Enhanced Connection Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Connection Health</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={isConnected && connectionStable ? "default" : "destructive"} className="text-xs">
                  {isConnected && connectionStable ? "STABLE" : 
                   isConnected ? "UNSTABLE" : "OFFLINE"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updates:</span>
                <span className="font-mono">{updateCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Age:</span>
                <span className={`font-mono ${connectionAge > 30 ? 'text-red-500' : connectionAge > 10 ? 'text-yellow-500' : 'text-green-500'}`}>
                  {connectionAge}s
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Health:</span>
                <Badge variant={apiHealthy ? "default" : "destructive"} className="text-xs">
                  {apiHealthy === null ? "CHECKING" : apiHealthy ? "OK" : "ERROR"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Data Source</h4>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <span className="text-muted-foreground">Mode:</span>
                </div>
                <Badge variant={isRealData ? "default" : "destructive"}>
                  {isRealData ? "REAL ACCOUNT" : "DEMO/SIM"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-muted-foreground">Trading:</span>
                </div>
                <Badge variant="outline">
                  ACTIVE
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        {memoryUsage && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Memory Usage</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Used: </span>
                <span className={memoryUsage.usedJSHeapSize > 50 * 1024 * 1024 ? "text-red-500" : "text-green-600"}>
                  {formatBytes(memoryUsage.usedJSHeapSize)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span>{formatBytes(memoryUsage.totalJSHeapSize)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Limit: </span>
                <span>{formatBytes(memoryUsage.jsHeapSizeLimit)}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) > 0.8 
                    ? 'bg-red-500' 
                    : (memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) > 0.6 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ 
                  width: `${(memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit) * 100}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Performance Metrics</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Renders: </span>
              <span className={performanceMetrics.renderCount > 1000 ? "text-yellow-500" : "text-green-600"}>
                {performanceMetrics.renderCount}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">WS Updates: </span>
              <span className="text-blue-600">{performanceMetrics.wsUpdates}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Interval: </span>
              <span>{performanceMetrics.avgUpdateInterval}ms</span>
            </div>
          </div>
        </div>

        {/* Crash Reports */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              System Issues ({crashReports.length})
            </h4>
            {crashReports.length > 0 && (
              <Button size="sm" variant="outline" onClick={clearCrashReports}>
                Clear
              </Button>
            )}
          </div>
          
          {crashReports.length === 0 ? (
            <div className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              No system issues detected
            </div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {crashReports.slice(-3).map((report, index) => (
                <div key={index} className="text-xs p-2 bg-red-50 rounded border">
                  <div className="font-medium text-red-700">{report.errorType}</div>
                  <div className="text-red-600 truncate">{report.errorMessage}</div>
                  <div className="text-muted-foreground">
                    {new Date(report.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={forceRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              localStorage.clear();
              sessionStorage.clear();
              window.location.reload();
            }}
          >
            Clear Cache
          </Button>
        </div>

        {/* System Warnings */}
        {!isRealData && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Demo Mode Active</span>
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              System using simulated data - connect real broker for live trading
            </div>
          </div>
        )}

        {(!isConnected || !connectionStable) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center gap-2 text-red-800">
              <Wifi className="h-4 w-4" />
              <span className="text-sm font-medium">Connection Issues Detected</span>
            </div>
            <div className="text-xs text-red-700 mt-1">
              {!isConnected ? 'WebSocket disconnected' : 'Connection unstable - check network'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
