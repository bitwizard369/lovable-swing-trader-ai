
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Brain, Target, Lock } from "lucide-react";
import { Portfolio as PortfolioType, Position } from "@/types/trading";

interface PortfolioSidebarProps {
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

export const PortfolioSidebar = ({ portfolio, activePositions = [] }: PortfolioSidebarProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const aiDataMap = new Map(
    activePositions.map(data => [data.position.id, data])
  );

  return (
    <div className="w-80 border-l bg-muted/20 p-4 space-y-4">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Available Balance</span>
            <span className="font-medium">{formatCurrency(portfolio.availableBalance)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Locked Profits
            </span>
            <span className="font-medium text-blue-600">{formatCurrency(portfolio.lockedProfits)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Day P&L</span>
            <span className={`font-medium ${portfolio.dayPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(portfolio.dayPnL)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Open Positions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Open Positions</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{openPositions.length}</Badge>
              {activePositions.length > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Brain className="h-3 w-3" />
                  {activePositions.length}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No open positions</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {openPositions.map((position) => {
                const aiData = aiDataMap.get(position.id);
                const isAIPosition = !!aiData;
                
                return (
                  <div key={position.id} className={`border rounded p-2 text-xs ${isAIPosition ? 'border-blue-200 bg-blue-50/50' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{position.symbol.toUpperCase()}</span>
                        <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'} className="text-xs px-1">
                          {position.side}
                        </Badge>
                        {isAIPosition && (
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs px-1">
                            <Brain className="h-2 w-2" />
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {position.unrealizedPnL >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(position.unrealizedPnL)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 text-xs mb-1">
                      <div>
                        <p className="text-muted-foreground">Size</p>
                        <p className="font-mono">{position.size.toFixed(4)}</p>
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
                      <div className="border-t pt-1 mt-1">
                        <div className="flex items-center gap-1 mb-1">
                          <Target className="h-3 w-3 text-blue-500" />
                          <span className="text-xs font-medium text-blue-700">AI Data</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Probability</p>
                            <p className="font-semibold text-green-600">
                              {(aiData.prediction.probability * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Risk</p>
                            <p className={`font-semibold ${aiData.prediction.riskScore < 0.5 ? 'text-green-600' : 'text-red-600'}`}>
                              {(aiData.prediction.riskScore * 100).toFixed(0)}%
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
