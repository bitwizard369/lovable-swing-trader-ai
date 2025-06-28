
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Activity, AlertTriangle } from "lucide-react";
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
  const spread = bestAsk - bestBid;
  const hasValidPrice = bestBid > 0 && bestAsk > 0;

  // Calculate price staleness (if no updates for too long)
  const isPriceStale = !hasValidPrice || orderBook.lastUpdateId === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Dashboard</h1>
          <p className="text-muted-foreground">Real-time data from Binance.US</p>
        </div>
        
        {/* Enhanced Connection Status */}
        <Card className="min-w-[250px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">Binance.US</span>
              </div>
              <div className="flex gap-1">
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Live" : "Offline"}
                </Badge>
                {isPriceStale && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stale
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              API Health: <span className={apiHealthy ? "text-green-600" : "text-red-600"}>
                {apiHealthy === null ? "Checking..." : apiHealthy ? "OK" : "Error"}
              </span>
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

      {/* Enhanced Current Price Display */}
      <Card className={`${hasValidPrice ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <Activity className={`h-8 w-8 ${hasValidPrice ? 'text-blue-600' : 'text-red-600'}`} />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <p className="text-sm text-muted-foreground">BTC/USDT</p>
                <Badge variant="outline" className="text-xs">Binance.US</Badge>
              </div>
              <p className={`text-4xl font-bold ${hasValidPrice ? 'text-blue-900' : 'text-red-700'}`}>
                {hasValidPrice ? formatCurrency(currentPrice) : "No Price Data"}
              </p>
              {hasValidPrice ? (
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-2">
                  <span>Bid: {formatCurrency(bestBid)}</span>
                  <span>•</span>
                  <span>Ask: {formatCurrency(bestAsk)}</span>
                  <span>•</span>
                  <span>Spread: {formatCurrency(spread)}</span>
                </div>
              ) : (
                <p className="text-sm text-red-600 mt-2">
                  {isConnected ? "Waiting for price data..." : "Connect to receive live prices"}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Data Quality Indicator */}
      {isConnected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Price Data Quality</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${hasValidPrice ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>Price Feed: {hasValidPrice ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${orderBook.bids.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span>Order Book: {orderBook.bids.length > 0 ? `${orderBook.bids.length + orderBook.asks.length} levels` : 'Empty'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${orderBook.lastUpdateId > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                  <span>Last Update: {orderBook.lastUpdateId > 0 ? `#${orderBook.lastUpdateId}` : 'None'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
