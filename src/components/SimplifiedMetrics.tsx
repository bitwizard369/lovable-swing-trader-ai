
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Target, Percent } from "lucide-react";
import { Portfolio } from "@/types/trading";

interface SimplifiedMetricsProps {
  portfolio: Portfolio;
  modelPerformance: any;
}

export const SimplifiedMetrics = ({ portfolio, modelPerformance }: SimplifiedMetricsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
  const totalUnrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
  const equityChange = portfolio.baseCapital > 0 ? ((portfolio.equity - portfolio.baseCapital) / portfolio.baseCapital) * 100 : 0;

  const safeModelPerformance = {
    winRate: modelPerformance?.winRate || 0,
    sharpeRatio: modelPerformance?.sharpeRatio || 0,
    maxDrawdown: modelPerformance?.maxDrawdown || 0,
    totalTrades: modelPerformance?.totalTrades || 0
  };

  const metrics = [
    {
      title: "Total Equity",
      value: formatCurrency(portfolio.equity),
      subValue: `${equityChange >= 0 ? '+' : ''}${equityChange.toFixed(2)}%`,
      icon: DollarSign,
      color: equityChange >= 0 ? 'text-green-600' : 'text-red-600'
    },
    {
      title: "Unrealized P&L",
      value: formatCurrency(totalUnrealizedPnL),
      subValue: `${openPositions.length} positions`,
      icon: totalUnrealizedPnL >= 0 ? TrendingUp : TrendingDown,
      color: totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'
    },
    {
      title: "Win Rate",
      value: formatPercent(safeModelPerformance.winRate),
      subValue: `${safeModelPerformance.totalTrades} trades`,
      icon: Target,
      color: safeModelPerformance.winRate >= 0.6 ? 'text-green-600' : 'text-yellow-600'
    },
    {
      title: "Max Drawdown",
      value: formatPercent(Math.abs(safeModelPerformance.maxDrawdown)),
      subValue: "Peak to trough",
      icon: Percent,
      color: 'text-red-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const IconComponent = metric.icon;
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gray-100 ${metric.color}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
                  <p className="text-xs text-muted-foreground">{metric.subValue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
