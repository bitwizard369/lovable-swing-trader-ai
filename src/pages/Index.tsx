
import { useState, useEffect } from "react";
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useDatabaseTradingSystem } from "@/hooks/useDatabaseTradingSystem";
import { SimplifiedTradingDashboard } from "@/components/SimplifiedTradingDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Square, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { TradingSignal } from "@/types/trading";

const Index = () => {
  const [isTrading, setIsTrading] = useState(false);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [lastSignalTime, setLastSignalTime] = useState<number>(0);
  
  const {
    isConnected,
    orderBook,
    apiHealthy,
    connect,
    disconnect,
  } = useBinanceWebSocket('btcusdt');

  const tradingSystem = useDatabaseTradingSystem({
    symbol: 'BTCUSDT',
    initialBalance: 10000,
    maxPositions: 5,
    riskPerTrade: 0.02
  });

  // Initialize trading system
  useEffect(() => {
    if (!tradingSystem.isInitialized && !tradingSystem.isLoading) {
      console.log('[Index] Initializing database trading system...');
      tradingSystem.initialize();
    }
  }, []);

  // Calculate current price and market metrics
  const bestBid = orderBook.bids[0]?.price || 0;
  const bestAsk = orderBook.asks[0]?.price || 0;
  const currentPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : 0;

  // Update position prices when market price changes
  useEffect(() => {
    if (currentPrice && tradingSystem.isInitialized) {
      tradingSystem.updatePositionPrices({
        'BTCUSDT': currentPrice
      });
    }
  }, [currentPrice, tradingSystem.isInitialized]);

  // Simple momentum-based signal generation
  const generateTradingSignal = (price: number): TradingSignal | null => {
    // Only generate signals if we have recent price data and trading is active
    if (!price || !isTrading || !tradingSystem.portfolio) return null;

    // Simple momentum strategy - buy on price increases, sell on decreases
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime;
    
    // Wait at least 30 seconds between signals
    if (timeSinceLastSignal < 30000) return null;

    // Get price trend from order book depth
    const bidDepth = orderBook.bids.slice(0, 5).reduce((sum, level) => sum + level.quantity, 0);
    const askDepth = orderBook.asks.slice(0, 5).reduce((sum, level) => sum + level.quantity, 0);
    const depthRatio = bidDepth / (askDepth || 1);

    // Simple trading logic
    const openPositions = tradingSystem.portfolio.positions.filter(p => p.status === 'OPEN');
    const hasOpenPosition = openPositions.length > 0;

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;
    let reasoning = '';

    if (!hasOpenPosition && depthRatio > 1.2 && spread < price * 0.001) {
      // More buying pressure than selling, tight spread - good time to buy
      action = 'BUY';
      confidence = Math.min(0.8, depthRatio / 2);
      reasoning = `Strong buying pressure detected (depth ratio: ${depthRatio.toFixed(2)})`;
    } else if (hasOpenPosition && (depthRatio < 0.8 || spread > price * 0.002)) {
      // Selling pressure or wide spread - consider taking profits
      action = 'SELL';
      confidence = Math.min(0.7, 1 / depthRatio);
      reasoning = `Taking profits - selling pressure detected (depth ratio: ${depthRatio.toFixed(2)})`;
    }

    if (action === 'HOLD') return null;

    const quantity = action === 'BUY' 
      ? Math.min(0.001, (tradingSystem.portfolio.availableBalance * 0.1) / price) // Risk 10% of available balance
      : openPositions[0]?.size || 0.001;

    return {
      symbol: 'BTCUSDT',
      action,
      confidence,
      price,
      quantity,
      timestamp: now,
      reasoning
    };
  };

  // Execute trading signals
  useEffect(() => {
    if (!isTrading || !currentPrice || !tradingSystem.isInitialized) return;

    const interval = setInterval(() => {
      const signal = generateTradingSignal(currentPrice);
      
      if (signal) {
        console.log(`[Index] Generated signal: ${signal.action} ${signal.symbol} at ${signal.price} (confidence: ${(signal.confidence * 100).toFixed(1)}%)`);
        
        // Add to signals list
        setSignals(prev => [signal, ...prev.slice(0, 19)]); // Keep last 20 signals
        setLastSignalTime(signal.timestamp);
        
        // Execute the signal
        tradingSystem.executeSignal(signal).then(success => {
          if (success) {
            console.log(`[Index] ✅ Signal executed successfully: ${signal.action}`);
          } else {
            console.log(`[Index] ❌ Failed to execute signal: ${signal.action}`);
          }
        });
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isTrading, currentPrice, tradingSystem.isInitialized, lastSignalTime]);

  // Auto-close positions that are too old or have significant losses
  useEffect(() => {
    if (!isTrading || !tradingSystem.portfolio) return;

    const interval = setInterval(() => {
      const openPositions = tradingSystem.portfolio.positions.filter(p => p.status === 'OPEN');
      const now = Date.now();

      openPositions.forEach(position => {
        const positionAge = now - position.timestamp;
        const maxAge = 5 * 60 * 1000; // 5 minutes max hold time
        const maxLoss = -50; // Close if loss exceeds $50

        if (positionAge > maxAge || position.unrealizedPnL < maxLoss) {
          console.log(`[Index] Auto-closing position ${position.id}: age=${Math.round(positionAge/1000)}s, PnL=${position.unrealizedPnL.toFixed(2)}`);
          tradingSystem.closePosition(position.id, currentPrice);
        }
      });
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isTrading, tradingSystem.portfolio, currentPrice]);

  const handleStartStopTrading = async () => {
    if (isTrading) {
      setIsTrading(false);
      console.log('[Index] 🛑 Trading stopped');
    } else {
      if (!tradingSystem.isInitialized) {
        await tradingSystem.initialize();
      }
      if (!isConnected) {
        await connect();
      }
      setIsTrading(true);
      console.log('[Index] ▶️ Trading started');
    }
  };

  const mockModelPerformance = {
    winRate: signals.length > 0 ? 0.65 : 0,
    sharpeRatio: 1.4,
    maxDrawdown: -0.03,
    totalTrades: signals.filter(s => s.action !== 'HOLD').length
  };

  if (tradingSystem.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <Brain className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Initializing AI Trading System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Trading Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-6 w-6" />
                <span>AI Trading System</span>
                <Badge variant="secondary">BTCUSDT</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isTrading ? 'default' : 'secondary'}>
                  {isTrading ? 'Active' : 'Stopped'}
                </Badge>
                <Button
                  onClick={handleStartStopTrading}
                  variant={isTrading ? 'destructive' : 'default'}
                  disabled={!tradingSystem.isInitialized}
                >
                  {isTrading ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      Stop Trading
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Trading
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Price</p>
                <p className="text-xl font-bold">${currentPrice?.toLocaleString() || '---'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Open Positions</p>
                <p className="text-xl font-bold">
                  {tradingSystem.portfolio?.positions.filter(p => p.status === 'OPEN').length || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Signals Generated</p>
                <p className="text-xl font-bold">{signals.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">System Status</p>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected && tradingSystem.isInitialized ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-semibold">
                    {isConnected && tradingSystem.isInitialized ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Signals */}
        {signals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent AI Signals
                <Badge variant="outline">{signals.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {signals.slice(0, 10).map((signal, index) => (
                  <div key={`${signal.timestamp}-${index}`} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      {signal.action === 'BUY' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <Badge variant={signal.action === 'BUY' ? 'default' : 'destructive'}>
                        {signal.action}
                      </Badge>
                      <span className="text-sm font-medium">${signal.price.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{Math.round(signal.confidence * 100)}%</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard */}
        <SimplifiedTradingDashboard
          isConnected={isConnected}
          apiHealthy={apiHealthy}
          onConnect={connect}
          onDisconnect={disconnect}
          orderBook={orderBook}
          portfolio={tradingSystem.portfolio || {
            baseCapital: 10000,
            availableBalance: 10000,
            lockedProfits: 0,
            positions: [],
            totalPnL: 0,
            dayPnL: 0,
            equity: 10000
          }}
          modelPerformance={mockModelPerformance}
          signals={signals}
        />
      </div>
    </div>
  );
};

export default Index;
