
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { useTradingSessionPersistence } from "@/hooks/useTradingSessionPersistence";
import { EnhancedDashboard } from "@/components/EnhancedDashboard";
import { SystemHealthMonitor } from "@/components/SystemHealthMonitor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect } from "react";

const Index = () => {
  const {
    isConnected,
    orderBook,
    apiHealthy,
    latestUpdate,
    connect,
    disconnect,
    checkAPIHealth
  } = useBinanceWebSocket('btcusdt');

  const {
    portfolio,
    indicators: advancedIndicators,
    marketContext,
    prediction,
    activePositions,
    config: tradingConfig,
    updateConfig,
    getModelPerformance,
    signals,
    latestSignal,
    basicIndicators,
  } = useAdvancedTradingSystem(
    'btcusdt',
    orderBook.bids,
    orderBook.asks
  );

  const {
    systemHealth,
    cleanupSession,
    resetSession,
    isRecovering
  } = useTradingSessionPersistence({
    symbol: 'btcusdt',
    autoSave: true,
    saveInterval: 5000,
    snapshotInterval: 30000,
    healthCheckInterval: 60000
  });

  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="dashboard" className="w-full">
        <div className="border-b">
          <div className="max-w-7xl mx-auto px-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="system">System Health</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          <EnhancedDashboard
            isConnected={isConnected}
            orderBook={orderBook}
            apiHealthy={apiHealthy}
            latestUpdate={latestUpdate}
            connect={connect}
            disconnect={disconnect}
            checkAPIHealth={checkAPIHealth}
            portfolio={portfolio}
            indicators={advancedIndicators}
            marketContext={marketContext}
            prediction={prediction}
            activePositions={activePositions}
            config={tradingConfig}
            updateConfig={updateConfig}
            getModelPerformance={getModelPerformance}
            signals={signals}
            latestSignal={latestSignal}
            basicIndicators={basicIndicators}
          />
        </TabsContent>

        <TabsContent value="system" className="space-y-6 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">System Health Monitor</h1>
              <p className="text-xl text-muted-foreground">Trading System Status & Diagnostics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SystemHealthMonitor
                healthData={systemHealth}
                onCleanup={cleanupSession}
                onReset={resetSession}
                isLoading={isRecovering}
              />
              
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium mb-2">System Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>WebSocket:</span>
                      <span className={isConnected ? 'text-green-600' : 'text-red-600'}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>API Health:</span>
                      <span className={apiHealthy ? 'text-green-600' : 'text-red-600'}>
                        {apiHealthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Positions:</span>
                      <span>{activePositions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recovery Mode:</span>
                      <span className={isRecovering ? 'text-yellow-600' : 'text-green-600'}>
                        {isRecovering ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {latestUpdate && (
        <div className="border-t bg-muted/30">
          <div className="max-w-7xl mx-auto px-6 py-2">
            <div className="text-center text-sm text-muted-foreground">
              Last update: {new Date(latestUpdate.E).toLocaleString()} | 
              Updates: {orderBook.bids.length} bids, {orderBook.asks.length} asks
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
