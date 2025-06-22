
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Brain, TrendingUp, TrendingDown, DollarSign, Activity, Target } from "lucide-react";
import { Portfolio as PortfolioType, Position, TradingSignal } from "@/types/trading";
import { AdvancedIndicators, MarketContext } from "@/services/advancedTechnicalAnalysis";
import { PredictionOutput } from "@/services/aiPredictionModel";
import { PortfolioDebugPanel } from "@/components/PortfolioDebugPanel";

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
}

interface TradingDashboardProps {
  isConnected: boolean;
  apiHealthy: boolean | null;
  latestUpdate: any;
  onConnect: () => void;
  onDisconnect: () => void;
  onCheckHealth: () => void;
  orderBook: OrderBook;
  portfolio: PortfolioType;
  activePositions: Array<{
    position: Position;
    prediction: {
      probability: number;
      confidence: number;
      expectedReturn: number;
      riskScore: number;
      timeHorizon: number;
    };
    entryTime: number;
  }>;
  indicators: AdvancedIndicators | null;
  basicIndicators: any;
  marketContext: MarketContext | null;
  prediction: PredictionOutput | null;
  modelPerformance: any;
  signals: TradingSignal[];
  latestSignal: TradingSignal | null;
  onConfigUpdate: (config: any) => void;
}

export const TradingDashboard = ({
  isConnected,
  apiHealthy,
  latestUpdate,
  onConnect,
  onDisconnect,
  onCheckHealth,
  orderBook,
  portfolio,
  activePositions,
  indicators,
  basicIndicators,
  marketContext,
  prediction,
  modelPerformance,
  signals,
  latestSignal,
  onConfigUpdate
}: TradingDashboardProps) => {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  const bestBid = orderBook.bids[0]?.price || 0;
  const bestAsk = orderBook.asks[0]?.price || 0;
  const spread = bestAsk - bestBid;

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Trading System</h1>
        <p className="text-gray-600">Real-time algorithmic trading dashboard</p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Connection Status */}
        <Card className="col-span-1">
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
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>API Health:</span>
                <Badge variant={apiHealthy ? "default" : "destructive"} className="text-xs">
                  {apiHealthy ? "OK" : "Error"}
                </Badge>
              </div>
              <Button size="sm" onClick={isConnected ? onDisconnect : onConnect} className="w-full">
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Value */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Portfolio</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency(portfolio.equity)}</div>
              <div className="text-xs text-gray-600">Available: {formatCurrency(portfolio.availableBalance)}</div>
              <div className={`text-sm ${totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                P&L: {formatCurrency(totalUnrealizedPnL)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Prediction */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">AI Signal</span>
            </div>
            {prediction ? (
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {formatPercent(prediction.probability)}
                </div>
                <div className="text-xs text-gray-600">
                  Confidence: {formatPercent(prediction.confidence)}
                </div>
                <div className="text-xs">
                  Expected: {prediction.expectedReturn.toFixed(2)}%
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading...</div>
            )}
          </CardContent>
        </Card>

        {/* Market Price */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">BTC/USDT</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold">{formatCurrency((bestBid + bestAsk) / 2)}</div>
              <div className="flex justify-between text-xs">
                <span className="text-green-600">Bid: {bestBid.toFixed(2)}</span>
                <span className="text-red-600">Ask: {bestAsk.toFixed(2)}</span>
              </div>
              <div className="text-xs text-gray-600">
                Spread: ${spread.toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portfolio Debug Panel */}
      <div className="mb-6">
        <PortfolioDebugPanel
          portfolio={portfolio}
        />
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        
        {/* Order Book */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Order Book</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-red-500 font-medium mb-1">Asks</div>
                  {orderBook.asks.slice(0, 5).map((ask, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{ask.price.toFixed(2)}</span>
                      <span>{ask.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-green-500 font-medium mb-1">Bids</div>
                  {orderBook.bids.slice(0, 5).map((bid, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{bid.price.toFixed(2)}</span>
                      <span>{bid.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Indicators */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Technical Analysis</h3>
            {basicIndicators && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-600">RSI</div>
                  <div className={`font-medium ${basicIndicators.rsi > 70 ? 'text-red-500' : basicIndicators.rsi < 30 ? 'text-green-500' : ''}`}>
                    {basicIndicators.rsi.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">MACD</div>
                  <div className={`font-medium ${basicIndicators.macd > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {basicIndicators.macd.toFixed(3)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600">EMA Fast</div>
                  <div className="font-medium">{basicIndicators.ema_fast.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-600">EMA Slow</div>
                  <div className="font-medium">{basicIndicators.ema_slow.toFixed(2)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Market Context */}
        <Card className="col-span-1">
          <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-3">Market Context</h3>
            {marketContext ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Volatility:</span>
                  <Badge variant="outline" className="text-xs">
                    {marketContext.volatilityRegime}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Regime:</span>
                  <Badge variant="outline" className="text-xs">
                    {marketContext.marketRegime.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Session:</span>
                  <Badge variant="outline" className="text-xs">
                    {marketContext.marketHour}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Analyzing...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Positions and Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Open Positions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Open Positions</h3>
              <Badge variant="outline">{openPositions.length}</Badge>
            </div>
            <div className="space-y-2">
              {openPositions.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No open positions</div>
              ) : (
                openPositions.slice(0, 5).map((position) => (
                  <div key={position.id} className="flex items-center justify-between p-2 border rounded text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {position.side}
                      </Badge>
                      <span className="font-medium">{position.symbol}</span>
                      <span>{position.size.toFixed(4)}</span>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(position.unrealizedPnL)}
                      </div>
                      <div className="text-gray-500">{formatCurrency(position.entryPrice)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Trading Signals</h3>
              <Badge variant="outline">{signals.length}</Badge>
            </div>
            <div className="space-y-2">
              {signals.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">No signals yet</div>
              ) : (
                signals.slice(-5).reverse().map((signal, index) => (
                  <div key={`${signal.timestamp}-${index}`} className="flex items-center justify-between p-2 border rounded text-xs">
                    <div className="flex items-center gap-2">
                      {signal.action === 'BUY' ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <Badge variant={signal.action === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {signal.action}
                      </Badge>
                      <span>{signal.symbol.toUpperCase()}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(signal.price)}</div>
                      <div className="text-gray-500">{Math.round(signal.confidence * 100)}%</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3">Model Performance</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="text-center">
              <div className="text-gray-600">Win Rate</div>
              <div className="text-lg font-bold text-green-600">
                {formatPercent(modelPerformance.winRate)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Sharpe Ratio</div>
              <div className="text-lg font-bold">
                {modelPerformance.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Max Drawdown</div>
              <div className="text-lg font-bold text-red-600">
                {formatPercent(modelPerformance.maxDrawdown)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Total Trades</div>
              <div className="text-lg font-bold">
                {modelPerformance.totalTrades}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
