import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useTradingSignals } from "@/hooks/useTradingSignals";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { OrderBook } from "@/components/OrderBook";
import { Portfolio } from "@/components/Portfolio";
import { TradingSignals } from "@/components/TradingSignals";
import { AdvancedTradingDashboard } from "@/components/AdvancedTradingDashboard";
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
    signals,
    indicators: basicIndicators,
    latestSignal
  } = useTradingSignals('btcusdt', orderBook.bids, orderBook.asks);

  const {
    portfolio,
    indicators: advancedIndicators,
    marketContext,
    prediction,
    activePositions,
    config: tradingConfig,
    updateConfig,
    getModelPerformance
  } = useAdvancedTradingSystem(
    'btcusdt',
    orderBook.bids,
    orderBook.asks
  );

  const modelPerformance = getModelPerformance();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">AI-Powered HFT Bot</h1>
          <p className="text-xl text-muted-foreground">Advanced Machine Learning Trading System</p>
        </div>

        <Tabs defaultValue="advanced" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="advanced">AI Trading</TabsTrigger>
            <TabsTrigger value="classic">Classic View</TabsTrigger>
            <TabsTrigger value="analysis">Technical Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="advanced" className="space-y-6">
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
                
                <Portfolio 
                  portfolio={portfolio} 
                  activePositions={activePositions}
                />
              </div>

              {/* Right columns - Advanced Trading Dashboard */}
              <div className="lg:col-span-3">
                <AdvancedTradingDashboard
                  indicators={advancedIndicators}
                  marketContext={marketContext}
                  prediction={prediction}
                  modelPerformance={modelPerformance}
                  onConfigUpdate={updateConfig}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="classic" className="space-y-6">
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
                
                <Portfolio 
                  portfolio={portfolio} 
                  activePositions={activePositions}
                />
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
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            {/* Technical Indicators Display */}
            {basicIndicators && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">RSI</p>
                  <p className={`font-mono ${basicIndicators.rsi > 70 ? 'text-red-500' : basicIndicators.rsi < 30 ? 'text-green-500' : 'text-foreground'}`}>
                    {basicIndicators.rsi.toFixed(2)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">EMA Fast</p>
                  <p className="font-mono">${basicIndicators.ema_fast.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">EMA Slow</p>
                  <p className="font-mono">${basicIndicators.ema_slow.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">MACD</p>
                  <p className={`font-mono ${basicIndicators.macd > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {basicIndicators.macd.toFixed(4)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Signal</p>
                  <p className="font-mono">{basicIndicators.signal.toFixed(4)}</p>
                </div>
              </div>
            )}

            {/* Advanced Indicators Grid */}
            {advancedIndicators && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">SMA 9</p>
                  <p className="font-mono text-sm">${advancedIndicators.sma_9.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">SMA 21</p>
                  <p className="font-mono text-sm">${advancedIndicators.sma_21.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Stoch %K</p>
                  <p className="font-mono text-sm">{advancedIndicators.stoch_k.toFixed(1)}</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Williams %R</p>
                  <p className="font-mono text-sm">{advancedIndicators.williams_r.toFixed(1)}</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">ATR</p>
                  <p className="font-mono text-sm">{advancedIndicators.atr.toFixed(2)}</p>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Volume Ratio</p>
                  <p className="font-mono text-sm">{advancedIndicators.volume_ratio.toFixed(2)}</p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

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
