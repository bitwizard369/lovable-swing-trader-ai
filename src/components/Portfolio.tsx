
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";
import { Portfolio as PortfolioType, Position } from "@/types/trading";

interface PortfolioProps {
  portfolio: PortfolioType;
}

export const Portfolio = ({ portfolio }: PortfolioProps) => {
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

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
  const equityChange = ((portfolio.equity - portfolio.totalBalance) / portfolio.totalBalance) * 100;

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Open Positions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Open Positions
            </span>
            <Badge variant="outline">{openPositions.length} positions</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openPositions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No open positions</p>
          ) : (
            <div className="space-y-3">
              {openPositions.map((position) => (
                <div key={position.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{position.symbol.toUpperCase()}</span>
                      <Badge variant={position.side === 'BUY' ? 'default' : 'destructive'}>
                        {position.side}
                      </Badge>
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
                  <div className="grid grid-cols-3 gap-4 text-sm">
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
