
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseTradingDashboard } from '@/components/DatabaseTradingDashboard';
import { SystemHealthMonitor } from '@/components/SystemHealthMonitor';
import { ProductionMetrics } from '@/components/ProductionMetrics';
import { SecurityMonitor } from '@/components/SecurityMonitor';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { useTradingSessionPersistence } from '@/hooks/useTradingSessionPersistence';
import { crashMonitor } from '@/services/crashMonitoringService';
import { Shield, Activity, Database, Lock, TrendingUp, AlertTriangle } from 'lucide-react';

export const ProductionDashboard = () => {
  const [systemHealth, setSystemHealth] = useState(true);
  const [activeTab, setActiveTab] = useState('trading');
  
  const sessionPersistence = useTradingSessionPersistence({
    symbol: 'BTCUSDT',
    autoSave: true,
    saveInterval: 5000,
    snapshotInterval: 30000,
    cleanupInterval: 300000
  });

  // Initialize crash monitoring
  useEffect(() => {
    console.log('[Production] 🚀 PRODUCTION SYSTEM: Initializing comprehensive monitoring...');
    
    // Update performance metrics
    crashMonitor.updatePerformanceMetrics({
      renderCount: 1,
      wsUpdates: 0,
      lastUpdateTime: Date.now(),
      avgUpdateInterval: 0,
      memoryUsed: 0
    });

    // Run initial health check
    sessionPersistence.performHealthCheck();
    
    return () => {
      crashMonitor.cleanup();
    };
  }, []);

  const handleSystemHealthChange = (healthy: boolean) => {
    setSystemHealth(healthy);
    if (!healthy) {
      console.error('[Production] 🚨 CRITICAL: System health degraded - monitoring closely');
    }
  };

  const handleEmergencyRecovery = async () => {
    console.log('[Production] 🚑 EMERGENCY: Initiating production recovery sequence...');
    await sessionPersistence.triggerEmergencyCleanup();
    crashMonitor.resetErrorCount();
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Production Header */}
        <Card className="border-2 border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-blue-600" />
                <span className="text-2xl font-bold text-blue-900">Production Trading System</span>
                <Badge variant="destructive" className="animate-pulse">LIVE</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={systemHealth ? 'default' : 'destructive'}>
                  {systemHealth ? 'OPERATIONAL' : 'DEGRADED'}
                </Badge>
                {!systemHealth && (
                  <Button 
                    onClick={handleEmergencyRecovery}
                    variant="destructive"
                    size="sm"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Emergency Recovery
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Database className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-sm font-semibold text-green-800">Database-First</p>
              </div>
              <div className="text-center">
                <Lock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Security Hardened</p>
              </div>
              <div className="text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-sm font-semibold text-orange-800">Real-time Monitor</p>
              </div>
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-sm font-semibold text-purple-800">Auto-scaling</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="health">System Health</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="trading" className="space-y-4">
            <DatabaseTradingDashboard />
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            <SystemHealthMonitor onHealthChange={handleSystemHealthChange} />
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            <ProductionMetrics />
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <SecurityMonitor />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProductionDashboard;
