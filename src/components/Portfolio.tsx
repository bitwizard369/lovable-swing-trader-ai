
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, PieChart, Brain, Target, Lock } from "lucide-react";
import { Portfolio as PortfolioType, Position } from "@/types/trading";

interface PortfolioProps {
  portfolio: PortfolioType;
  activePositions?: Array<{
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
}

export const Portfolio = ({ portfolio, activePositions = [] }: PortfolioProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Create a map of position IDs to their AI prediction data
  const aiDataMap = new Map(
    activePositions.map(data => [data.position.id, data])
  );

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const equityChange = portfolio.baseCapital > 0 ? ((portfolio.equity - portfolio.baseCapital) / portfolio.baseCapital) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Portfolio Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Equity</p>
              <p className="text-2xl font-bold">{formatCurrency(portfolio.equity)}</p>
              <p className={`text-sm ${equityChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatPercentage(equityChange)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-xl font-semibold">{formatCurrency(portfolio.availableBalance)}</p>
            </div>
            <div className="space-y-1">
               <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Locked Profits</p>
              </div>
              <p className="text-xl font-semibold text-blue-500">{formatCurrency(portfolio.lockedProfits)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total P&L</p>
              <p className={`text-xl font-semibold ${portfolio.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(portfolio.totalPnL)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Unrealized P&L</p>
              <p className={`text-xl font-semibold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatCurrency(totalUnrealizedPnL)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Open Positions
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{openPositions.length} positions</Badge>
              {activePositions.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {activePositions.length} AI
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No open positions</p>
          ) : (
            <div className="space-y-3">
              {openPositions.map((position) => {
                const aiData = aiDataMap.get(position.id);
                const isAIPosition = !!aiData;
                
                return (
                  <div key={position.id} className={`border rounded-lg p-3 ${isAIPosition ? 'border-blue-200 bg-blue-50/50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{position.symbol.toUpperCase()}</span>
                        <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'}>
                          {position.side}
                        </Badge>
                        {isAIPosition && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Brain className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {position.unrealizedPnL >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm mb-2">
                      <div>
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-mono">{position.size.toFixed(6)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Entry</p>
                        <p className="font-mono">{formatCurrency(position.entryPrice)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current</p>
                        <p className="font-mono">{formatCurrency(position.currentPrice)}</p>
                      </div>
                    </div>

                    {/* AI Prediction Data */}
                    {isAIPosition && aiData && (
                      <div className="border-t pt-2 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700">AI Prediction Data</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Probability</p>
                            <p className="font-semibold text-green-600">
                              {(aiData.prediction.probability * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Confidence</p>
                            <p className="font-semibold">
                              {(aiData.prediction.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expected</p>
                            <p className={`font-semibold ${aiData.prediction.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {aiData.prediction.expectedReturn.toFixed(2)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Risk Score</p>
                            <p className={`font-semibold ${aiData.prediction.riskScore < 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                              {(aiData.prediction.riskScore * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
