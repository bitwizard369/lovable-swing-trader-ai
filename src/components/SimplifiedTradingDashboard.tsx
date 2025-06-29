
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Activity, AlertTriangle } from "lucide-react";
import { SimplifiedMetrics } from "./SimplifiedMetrics";
import { SimplifiedPositions } from "./SimplifiedPositions";
import { useTradingStore, selectPriceData, selectCurrentPrice, selectPortfolio, selectWebSocketState, selectSignals, selectModelPerformance } from "@/stores/tradingStore";
import { usePriceStaleness } from "@/hooks/usePriceStaleness";

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
  portfolio: any;
  modelPerformance: any;
  signals: any[];
}

export const SimplifiedTradingDashboard = ({
  onConnect,
  onDisconnect,
}: Omit<SimplifiedTradingDashboardProps, 'isConnected' | 'apiHealthy' | 'orderBook' | 'portfolio' | 'modelPerformance' | 'signals'>) => {
  // Use centralized store instead of props
  const priceData = useTradingStore(selectPriceData);
  const currentPrice = useTradingStore(selectCurrentPrice);
  const portfolio = useTradingStore(selectPortfolio);
  const webSocketState = useTradingStore(selectWebSocketState);
  const signals = useTradingStore(selectSignals);
  const modelPerformance = useTradingStore(selectModelPerformance);
  const isPriceStale = useTradingStore(state => state.isPriceStale);

  // Set up price staleness detection
  usePriceStaleness();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const bid = priceData?.bid || 0;
  const ask = priceData?.ask || 0;

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
                {webSocketState.isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">Connection</span>
                {isPriceStale && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
              </div>
              <Badge variant={webSocketState.isConnected ? "default" : "destructive"}>
                {webSocketState.isConnected ? "Live" : "Offline"}
              </Badge>
            </div>
            <Button 
              size="sm" 
              onClick={webSocketState.isConnected ? onDisconnect : onConnect} 
              className="w-full"
              variant={webSocketState.isConnected ? "destructive" : "default"}
            >
              {webSocketState.isConnected ? "Disconnect" : "Connect"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Current Price - Now using centralized store */}
      <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 ${isPriceStale ? 'border-yellow-300' : ''}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-4">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">BTC/USDT</p>
              <p className="text-4xl font-bold text-blue-900">
                {formatCurrency(currentPrice)}
                {isPriceStale && <span className="text-sm text-yellow-600 ml-2">(STALE)</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                Bid: {formatCurrency(bid)} | Ask: {formatCurrency(ask)}
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
