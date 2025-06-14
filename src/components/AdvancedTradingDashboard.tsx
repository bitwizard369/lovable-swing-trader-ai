
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, TrendingDown, Target, Shield, Clock, BarChart3 } from "lucide-react";
import { AdvancedIndicators, MarketContext } from "@/services/advancedTechnicalAnalysis";
import { PredictionOutput } from "@/services/aiPredictionModel";

interface AdvancedTradingDashboardProps {
  indicators: AdvancedIndicators | null;
  marketContext: MarketContext | null;
  prediction: PredictionOutput | null;
  activePositions: any[];
  modelPerformance: any;
  onConfigUpdate: (config: any) => void;
}

export const AdvancedTradingDashboard = ({
  indicators,
  marketContext,
  prediction,
  activePositions,
  modelPerformance,
  onConfigUpdate
}: AdvancedTradingDashboardProps) => {
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* AI Prediction Panel */}
      {prediction && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              AI Prediction Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Profit Probability</p>
                <div className="text-2xl font-bold text-green-500">
                  {formatPercent(prediction.probability)}
                </div>
                <Progress value={prediction.probability * 100} className="mt-1" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Confidence</p>
                <div className="text-2xl font-bold">
                  {formatPercent(prediction.confidence)}
                </div>
                <Progress value={prediction.confidence * 100} className="mt-1" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Expected Return</p>
                <div className={`text-2xl font-bold ${prediction.expectedReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {prediction.expectedReturn.toFixed(2)}%
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Risk Score</p>
                <div className={`text-2xl font-bold ${prediction.riskScore < 0.5 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(prediction.riskScore)}
                </div>
                <Progress value={prediction.riskScore * 100} className="mt-1" />
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Technical</p>
                <div className="font-mono">{formatPercent(prediction.features.technical)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Momentum</p>
                <div className="font-mono">{formatPercent(prediction.features.momentum)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Volatility</p>
                <div className="font-mono">{formatPercent(prediction.features.volatility)}</div>
              </div>
              <div>
                <p className="text-muted-foreground">Structure</p>
                <div className="font-mono">{formatPercent(prediction.features.market_structure)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Context & Advanced Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Context */}
        {marketContext && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Market Context
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Volatility Regime:</span>
                  <Badge variant={
                    marketContext.volatilityRegime === 'LOW' ? 'default' :
                    marketContext.volatilityRegime === 'MEDIUM' ? 'secondary' : 'destructive'
                  }>
                    {marketContext.volatilityRegime}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Trend Direction:</span>
                  <Badge variant={
                    marketContext.trendDirection === 'BULLISH' ? 'default' :
                    marketContext.trendDirection === 'BEARISH' ? 'destructive' : 'secondary'
                  }>
                    {marketContext.trendDirection}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Market Hour:</span>
                  <Badge variant="outline">{marketContext.marketHour}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">News Impact:</span>
                  <Badge variant="outline">{marketContext.newsImpact}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Advanced Technical Indicators */}
        {indicators && (
          <Card>
            <CardHeader>
              <CardTitle>Technical Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">RSI (14)</p>
                  <div className={`font-mono ${indicators.rsi_14 > 70 ? 'text-red-500' : indicators.rsi_14 < 30 ? 'text-green-500' : ''}`}>
                    {indicators.rsi_14.toFixed(2)}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">MACD</p>
                  <div className={`font-mono ${indicators.macd > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {indicators.macd.toFixed(4)}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground">EMA 12</p>
                  <div className="font-mono">{formatPrice(indicators.ema_12)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">EMA 26</p>
                  <div className="font-mono">{formatPrice(indicators.ema_26)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Bollinger Upper</p>
                  <div className="font-mono">{formatPrice(indicators.bollinger_upper)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Bollinger Lower</p>
                  <div className="font-mono">{formatPrice(indicators.bollinger_lower)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">ATR</p>
                  <div className="font-mono">{indicators.atr.toFixed(2)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Trend Strength</p>
                  <div className="font-mono">{indicators.trend_strength.toFixed(2)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Model Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            AI Model Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <div className="text-xl font-bold text-green-500">
                {formatPercent(modelPerformance.winRate)}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
              <div className="text-xl font-bold">
                {modelPerformance.sharpeRatio.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Max Drawdown</p>
              <div className="text-xl font-bold text-red-500">
                {formatPercent(modelPerformance.maxDrawdown)}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Trades</p>
              <div className="text-xl font-bold">
                {modelPerformance.totalTrades}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active AI Positions */}
      {activePositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active AI Positions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activePositions.map((data, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={data.position.side === 'BUY' ? 'default' : 'destructive'}>
                        {data.position.side}
                      </Badge>
                      <span className="font-medium">{data.position.symbol.toUpperCase()}</span>
                      <span className="text-sm text-muted-foreground">
                        Size: {data.position.size.toFixed(6)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">
                        Probability: {formatPercent(data.prediction.probability)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Expected: {data.prediction.expectedReturn.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Entry Price</p>
                      <p className="font-mono">{formatPrice(data.position.entryPrice)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time Horizon</p>
                      <p className="font-mono">{data.prediction.timeHorizon}s</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Risk Score</p>
                      <p className="font-mono">{formatPercent(data.prediction.riskScore)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
