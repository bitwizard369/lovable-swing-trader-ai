
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, ShieldAlert } from "lucide-react";
import { Position } from "@/types/trading";

interface SimplifiedPositionsProps {
  positions: Position[];
}

export const SimplifiedPositions = ({ positions }: SimplifiedPositionsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const calculateTPSL = (position: Position) => {
    const tpPercentage = 0.02; // 2% take profit
    const slPercentage = 0.01; // 1% stop loss
    
    if (position.side === 'BUY') {
      return {
        takeProfit: position.entryPrice * (1 + tpPercentage),
        stopLoss: position.entryPrice * (1 - slPercentage)
      };
    } else {
      return {
        takeProfit: position.entryPrice * (1 - tpPercentage),
        stopLoss: position.entryPrice * (1 + slPercentage)
      };
    }
  };

  const openPositions = positions.filter(p => p.status === 'OPEN');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Open Positions</span>
          <Badge variant="outline">{openPositions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {openPositions.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No open positions</p>
        ) : (
          <div className="space-y-4">
            {openPositions.map((position) => {
              const { takeProfit, stopLoss } = calculateTPSL(position);
              const pnlPercent = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
              const isProfit = position.unrealizedPnL >= 0;

              return (
                <div key={position.id} className="border rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{position.symbol.toUpperCase()}</span>
                      <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'}>
                        {position.side}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(position.unrealizedPnL)}
                      </div>
                      <div className={`text-sm ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Position Details Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Size</p>
                      <p className="font-semibold">{position.size.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Entry</p>
                      <p className="font-semibold">{formatCurrency(position.entryPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="font-semibold">{formatCurrency(position.currentPrice)}</p>
                    </div>
                  </div>

                  {/* TP/SL Levels */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Take Profit</p>
                        <p className="font-semibold text-green-600">{formatCurrency(takeProfit)}</p>
                        <p className="text-xs text-green-600">
                          {position.side === 'BUY' ? '+2.0%' : '-2.0%'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Stop Loss</p>
                        <p className="font-semibold text-red-600">{formatCurrency(stopLoss)}</p>
                        <p className="text-xs text-red-600">
                          {position.side === 'BUY' ? '-1.0%' : '+1.0%'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
