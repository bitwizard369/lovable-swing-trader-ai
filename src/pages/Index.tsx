
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { StatusBar } from "@/components/StatusBar";
import { KPIMetricsGrid } from "@/components/KPIMetricsGrid";
import { DashboardTabs } from "@/components/DashboardTabs";
import { PortfolioSidebar } from "@/components/PortfolioSidebar";
import { Button } from "@/components/ui/button";
import { Settings, Activity } from "lucide-react";

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

  const modelPerformance = getModelPerformance();
  
  // Get current price from order book
  const currentPrice = orderBook.asks.length > 0 ? orderBook.asks[0]?.price : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Status Bar */}
      <StatusBar
        isConnected={isConnected}
        apiHealthy={apiHealthy}
        latestUpdate={latestUpdate}
        symbol="btcusdt"
        currentPrice={currentPrice}
      />

      {/* Main Content Area */}
      <div className="flex">
        {/* Main Dashboard */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">AI Trading Dashboard</h1>
              <p className="text-muted-foreground">Advanced Machine Learning Trading System</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={checkAPIHealth}
                className="flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Check Health
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={isConnected ? disconnect : connect}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* KPI Metrics Grid */}
          <KPIMetricsGrid
            portfolio={portfolio}
            modelPerformance={modelPerformance}
            prediction={prediction}
          />

          {/* Dashboard Tabs */}
          <DashboardTabs
            indicators={advancedIndicators}
            marketContext={marketContext}
            prediction={prediction}
            modelPerformance={modelPerformance}
            onConfigUpdate={updateConfig}
            signals={signals}
            latestSignal={latestSignal}
            orderBook={orderBook}
            isConnected={isConnected}
            symbol="btcusdt"
            basicIndicators={basicIndicators}
            advancedIndicators={advancedIndicators}
          />
        </div>

        {/* Portfolio Sidebar */}
        <PortfolioSidebar
          portfolio={portfolio}
          activePositions={activePositions}
        />
      </div>
    </div>
  );
};

export default Index;
