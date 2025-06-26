
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Activity, Database, Wifi, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { crashMonitor } from "@/services/crashMonitoringService";
import { RealPortfolioService } from "@/services/realPortfolioService";

export const SystemHealthDebugPanel = () => {
  const [performanceMetrics, setPerformanceMetrics] = useState(crashMonitor.getPerformanceMetrics());
  const [crashReports, setCrashReports] = useState(crashMonitor.getCrashReports());
  const [memoryUsage, setMemoryUsage] = useState<any>(null);
  const [isRealData, setIsRealData] = useState(false);

  useEffect(() => {
    const portfolioService = RealPortfolioService.getInstance();
    setIsRealData(portfolioService.isUsingRealData());

    const interval = setInterval(() => {
      setPerformanceMetrics(crashMonitor.getPerformanceMetrics());
      setCrashReports(crashMonitor.getCrashReports());
      
      if ('memory' in performance) {
        setMemoryUsage((performance as any).memory);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health & Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Data Source Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="text-sm">Data Source:</span>
            </div>
            <Badge variant={isRealData ? "default" : "destructive"}>
              {isRealData ? "Real Account" : "Demo/Simulated"}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span className="text-sm">WebSocket Updates:</span>
            </div>
            <Badge variant="outline">
              {performanceMetrics.wsUpdates}
            </Badge>
          </div>
        </div>

        {/* Memory Usage */}
        {memoryUsage && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Memory Usage</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Used: </span>
                <span className={memoryUsage.usedJSHeapSize > 50 * 1024 * 1024 ? "text-red-500" : ""}>
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
          </div>
        )}

        {/* Performance Metrics */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Performance Metrics</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Render Count: </span>
              <span className={performanceMetrics.renderCount > 500 ? "text-yellow-500" : ""}>
                {performanceMetrics.renderCount}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Update Interval: </span>
              <span>{performanceMetrics.avgUpdateInterval}ms</span>
            </div>
          </div>
        </div>

        {/* Crash Reports */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Recent Crashes ({crashReports.length})
            </h4>
            {crashReports.length > 0 && (
              <Button size="sm" variant="outline" onClick={clearCrashReports}>
                Clear
              </Button>
            )}
          </div>
          
          {crashReports.length === 0 ? (
            <div className="text-sm text-green-600">✅ No crashes detected</div>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {crashReports.slice(-5).map((report, index) => (
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
            Clear All Cache
          </Button>
        </div>

        {/* Warnings */}
        {!isRealData && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Using Simulated Data</span>
            </div>
            <div className="text-xs text-yellow-700 mt-1">
              Connect real broker API for live trading
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
