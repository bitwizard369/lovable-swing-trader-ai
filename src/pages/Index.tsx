
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { TradingDashboard } from "@/components/trading/TradingDashboard";
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
    portfolioReconciliation,
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
    validateAndReconcilePortfolio,
  } = useAdvancedTradingSystem(
    'btcusdt',
    orderBook.bids,
    orderBook.asks
  );

  const modelPerformance = getModelPerformance();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <TradingDashboard
        isConnected={isConnected}
        apiHealthy={apiHealthy}
        latestUpdate={latestUpdate}
        onConnect={connect}
        onDisconnect={disconnect}
        onCheckHealth={checkAPIHealth}
        orderBook={orderBook}
        portfolio={portfolio}
        activePositions={activePositions}
        indicators={advancedIndicators}
        basicIndicators={basicIndicators}
        marketContext={marketContext}
        prediction={prediction}
        modelPerformance={modelPerformance}
        signals={signals}
        latestSignal={latestSignal}
        onConfigUpdate={updateConfig}
        portfolioReconciliation={portfolioReconciliation}
        onPortfolioReconcile={validateAndReconcilePortfolio}
      />
    </div>
  );
};

export default Index;
