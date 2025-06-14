
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useTradingSignals } from "@/hooks/useTradingSignals";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { OrderBook } from "@/components/OrderBook";
import { Portfolio } from "@/components/Portfolio";
import { TradingSignals } from "@/components/TradingSignals";
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
    config,
    updatePositionPrices,
    addPosition,
    closePosition,
    canOpenPosition
  } = usePortfolio();

  const {
    signals,
    indicators,
    latestSignal
  } = useTradingSignals('btcusdt', orderBook.bids, orderBook.asks);

  // Update position prices when order book changes
  useEffect(() => {
    if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const currentPrice = (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
      updatePositionPrices('btcusdt', currentPrice);
    }
  }, [orderBook, updatePositionPrices]);

  const handleExecuteSignal = (signal: any) => {
    const positionValue = signal.price * signal.quantity;
    
    if (canOpenPosition(positionValue)) {
      addPosition({
        symbol: signal.symbol,
        side: signal.action,
        size: signal.quantity,
        entryPrice: signal.price,
        currentPrice: signal.price,
        timestamp: signal.timestamp
      });
      
      console.log(`Executed ${signal.action} signal for ${signal.symbol} at ${signal.price}`);
    } else {
      console.log('Cannot execute signal: Risk limits exceeded');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">High-Frequency Trading Bot</h1>
          <p className="text-xl text-muted-foreground">Real-time Binance.US Market Data & Automated Trading</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left column - Status and Portfolio */}
          <div className="lg:col-span-1 space-y-6">
            <WebSocketStatus
              isConnected={isConnected}
              apiHealthy={apiHealthy}
              latestUpdate={latestUpdate}
              onConnect={connect}
              onDisconnect={disconnect}
              onCheckHealth={checkAPIHealth}
            />
            
            <Portfolio portfolio={portfolio} />
          </div>

          {/* Middle column - Order Book */}
          <div className="lg:col-span-1">
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              symbol="btcusdt"
              isConnected={isConnected}
            />
          </div>

          {/* Right columns - Trading Signals */}
          <div className="lg:col-span-2">
            <TradingSignals
              signals={signals}
              latestSignal={latestSignal}
              onExecuteSignal={handleExecuteSignal}
            />
          </div>
        </div>

        {/* Technical Indicators Display */}
        {indicators && (
          <div className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/50">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">RSI</p>
                <p className={`font-mono ${indicators.rsi > 70 ? 'text-red-500' : indicators.rsi < 30 ? 'text-green-500' : 'text-foreground'}`}>
                  {indicators.rsi.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">EMA Fast</p>
                <p className="font-mono">${indicators.ema_fast.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">EMA Slow</p>
                <p className="font-mono">${indicators.ema_slow.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">MACD</p>
                <p className={`font-mono ${indicators.macd > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {indicators.macd.toFixed(4)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Signal</p>
                <p className="font-mono">{indicators.signal.toFixed(4)}</p>
              </div>
            </div>
          </div>
        )}

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
