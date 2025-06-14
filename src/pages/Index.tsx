
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { OrderBook } from "@/components/OrderBook";

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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">High-Frequency Trading Bot</h1>
          <p className="text-xl text-muted-foreground">Real-time Binance.US Market Data</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <WebSocketStatus
              isConnected={isConnected}
              apiHealthy={apiHealthy}
              latestUpdate={latestUpdate}
              onConnect={connect}
              onDisconnect={disconnect}
              onCheckHealth={checkAPIHealth}
            />
          </div>

          <div className="lg:col-span-2">
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              symbol="btcusdt"
              isConnected={isConnected}
            />
          </div>
        </div>

        {latestUpdate && (
          <div className="mt-6">
            <div className="text-center text-sm text-muted-foreground">
              Last update: {new Date(latestUpdate.E).toLocaleString()} | 
              Updates: {orderBook.bids.length} bids, {orderBook.asks.length} asks
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
