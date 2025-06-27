
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDatabaseTradingSystem } from '@/hooks/useDatabaseTradingSystem';
import { SimplifiedMetrics } from './SimplifiedMetrics';
import { SimplifiedPositions } from './SimplifiedPositions';
import { useBinanceWebSocket } from '@/hooks/useBinanceWebSocket';
import { Play, Square, Database, Wifi, WifiOff } from 'lucide-react';

export const DatabaseTradingDashboard = () => {
  const [isRunning, setIsRunning] = useState(false);
  
  const tradingSystem = useDatabaseTradingSystem({
    symbol: 'BTCUSDT',
    initialBalance: 10000,
    maxPositions: 10,
    riskPerTrade: 0.02
  });

  const { 
    lastPrice, 
    isConnected: wsConnected, 
    volume24h,
    priceChange24h 
  } = useBinanceWebSocket('BTCUSDT');

  // Initialize trading system on mount
  useEffect(() => {
    if (!tradingSystem.isInitialized && !tradingSystem.isLoading) {
      tradingSystem.initialize();
    }
  }, []);

  // Update position prices when price changes
  useEffect(() => {
    if (lastPrice && tradingSystem.isInitialized) {
      tradingSystem.updatePositionPrices({
        'BTCUSDT': lastPrice
      });
    }
  }, [lastPrice, tradingSystem.isInitialized]);

  const handleStartStop = async () => {
    if (isRunning) {
      setIsRunning(false);
      console.log('[DB Dashboard] 🛑 Trading stopped');
    } else {
      if (!tradingSystem.isInitialized) {
        await tradingSystem.initialize();
      }
      setIsRunning(true);
      console.log('[DB Dashboard] ▶️ Trading started');
    }
  };

  const handleEndSession = async () => {
    const success = await tradingSystem.endSession();
    if (success) {
      setIsRunning(false);
    }
  };

  if (tradingSystem.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Database className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Initializing database trading system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              <span>Database Trading System</span>
              <Badge variant="secondary">BTCUSDT</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {wsConnected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-muted-foreground">
                  {wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <Badge variant={isRunning ? 'default' : 'secondary'}>
                {isRunning ? 'Running' : 'Stopped'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div>
                <p className="text-sm text-muted-foreground">Current Price</p>
                <p className="text-2xl font-bold">
                  ${lastPrice?.toLocaleString() || '---'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">24h Change</p>
                <p className={`text-xl font-semibold ${
                  (priceChange24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {priceChange24h ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%` : '---'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-xl font-semibold">
                  {volume24h ? `${(volume24h / 1000000).toFixed(1)}M` : '---'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleStartStop}
                variant={isRunning ? 'destructive' : 'default'}
                disabled={!tradingSystem.isInitialized}
              >
                {isRunning ? (
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
              <Button
                onClick={handleEndSession}
                variant="outline"
                disabled={!tradingSystem.isInitialized}
              >
                End Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Metrics */}
      {tradingSystem.portfolio && (
        <>
          <SimplifiedMetrics 
            portfolio={tradingSystem.portfolio}
            modelPerformance={{
              winRate: 0.45,
              sharpeRatio: 1.2,
              maxDrawdown: -0.05,
              totalTrades: 0
            }}
          />
          
          <SimplifiedPositions positions={tradingSystem.portfolio.positions} />
        </>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>Database System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Session ID</p>
              <p className="font-mono text-sm">
                {tradingSystem.sessionId ? 
                  `${tradingSystem.sessionId.slice(0, 8)}...` : 
                  'Not initialized'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Source</p>
              <p className="text-sm font-semibold text-blue-600">Database</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={tradingSystem.isInitialized ? 'default' : 'secondary'}>
                {tradingSystem.isInitialized ? 'Initialized' : 'Not Ready'}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Positions</p>
              <p className="text-sm font-semibold">
                {tradingSystem.portfolio?.positions.filter(p => p.status === 'OPEN').length || 0} Open
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
