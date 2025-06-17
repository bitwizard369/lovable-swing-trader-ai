
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystemWithPersistence } from "@/hooks/useAdvancedTradingSystemWithPersistence";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { OrderBook } from "@/components/OrderBook";
import { Portfolio } from "@/components/Portfolio";
import { TradingSignals } from "@/components/TradingSignals";
import { AdvancedTradingDashboard } from "@/components/AdvancedTradingDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

const Index = () => {
  const { user, signOut } = useAuth();
  
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
    // Data for classic view
    signals,
    latestSignal,
    basicIndicators,
    // Session persistence
    currentSession,
    isRecovering,
    isAuthenticated,
    recoveredData,
    isInitialized,
    sessionError,
    saveSignal,
    endSession,
  } = useAdvancedTradingSystemWithPersistence(
    'btcusdt',
    orderBook.bids,
    orderBook.asks
  );

  const modelPerformance = getModelPerformance();

  const handleSignOut = async () => {
    try {
      if (currentSession) {
        await endSession();
      }
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  // Show recovery state
  if (isRecovering) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <h2 className="text-xl font-semibold">Recovering Trading Session...</h2>
          <p className="text-muted-foreground">Restoring your portfolio and positions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">AI-Powered HFT Bot</h1>
            <p className="text-xl text-muted-foreground">Advanced Machine Learning Trading System</p>
            {currentSession && (
              <p className="text-sm text-green-600 mt-2">
                Session: {currentSession.id.slice(0, 8)}... | Status: {currentSession.status.toUpperCase()}
              </p>
            )}
            {recoveredData && (
              <p className="text-sm text-blue-600">
                ✅ Portfolio recovered with {recoveredData.positions.length} positions
              </p>
            )}
            {sessionError && (
              <p className="text-sm text-red-600">
                ⚠️ Session error: {sessionError}
              </p>
            )}
          </div>
          
          {user && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          )}
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
              {currentSession && ` | Session: ${currentSession.status}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
