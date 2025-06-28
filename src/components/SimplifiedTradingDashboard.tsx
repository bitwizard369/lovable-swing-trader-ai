
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Activity } from "lucide-react";
import { Portfolio, Position, TradingSignal } from "@/types/trading";
import { SimplifiedMetrics } from "./SimplifiedMetrics";
import { SimplifiedPositions } from "./SimplifiedPositions";

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
}

interface SimplifiedTradingDashboardProps {
  isConnected: boolean;
  apiHealthy: boolean | null;
  onConnect: () => void;
  onDisconnect: () => void;
  orderBook: OrderBook;
  portfolio: Portfolio;
  modelPerformance: any;
  signals: TradingSignal[];
}

export const SimplifiedTradingDashboard = ({
  isConnected,
  apiHealthy,
  onConnect,
  onDisconnect,
  orderBook,
  portfolio,
  modelPerformance,
  signals
}: SimplifiedTradingDashboardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const bestBid = orderBook.bids[0]?.price || 0;
  const bestAsk = orderBook.asks[0]?.price || 0;
  const currentPrice = (bestBid + bestAsk) / 2;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground">Focus on profits and performance</p>
        </div>
        
        {/* Connection Status */}
        <Card className="min-w-[200px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">Connection</span>
              </div>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Live" : "Offline"}
              </Badge>
            </div>
            <Button 
              size="sm" 
              onClick={isConnected ? onDisconnect : onConnect} 
              className="w-full"
              variant={isConnected ? "destructive" : "default"}
            >
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Current Price */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">BTC/USDT</p>
              <p className="text-4xl font-bold text-blue-900">{formatCurrency(currentPrice)}</p>
              <p className="text-sm text-muted-foreground">
                Bid: {formatCurrency(bestBid)} | Ask: {formatCurrency(bestAsk)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <SimplifiedMetrics portfolio={portfolio} modelPerformance={modelPerformance} />

      {/* Positions */}
      <SimplifiedPositions positions={portfolio.positions} />

      {/* Recent Signals - Simplified */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Signals</h3>
            <Badge variant="outline">{signals.length}</Badge>
          </div>
          {signals.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No recent signals</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {signals.slice(-6).reverse().map((signal, index) => (
                <div key={`${signal.timestamp}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Badge variant={signal.action === 'BUY' ? 'default' : 'destructive'} className="mb-1">
                      {signal.action}
                    </Badge>
                    <p className="text-sm font-medium">{formatCurrency(signal.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{Math.round((signal.confidence || 0) * 100)}%</p>
                    <p className="text-xs text-muted-foreground">Confidence</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
