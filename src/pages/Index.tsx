
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { SimplifiedTradingDashboard } from "@/components/SimplifiedTradingDashboard";

const Index = () => {
  const {
    isConnected,
    orderBook,
    apiHealthy,
    connect,
    disconnect,
  } = useBinanceWebSocket('btcusdt');

  const {
    portfolio,
    signals,
    getModelPerformance,
  } = useAdvancedTradingSystem(
    'btcusdt',
    orderBook.bids,
    orderBook.asks
  );

  const modelPerformance = getModelPerformance();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SimplifiedTradingDashboard
        isConnected={isConnected}
        apiHealthy={apiHealthy}
        onConnect={connect}
        onDisconnect={disconnect}
        orderBook={orderBook}
        portfolio={portfolio}
        modelPerformance={modelPerformance}
        signals={signals}
      />
    </div>
  );
};

export default Index;
