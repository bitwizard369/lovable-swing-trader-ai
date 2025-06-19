
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, PieChart, Target, Brain } from "lucide-react";
import { Portfolio } from "@/types/trading";

interface KPIMetricsGridProps {
  portfolio: Portfolio;
  modelPerformance: any;
  prediction: any;
}

export const KPIMetricsGrid = ({ portfolio, modelPerformance, prediction }: KPIMetricsGridProps) => {
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
  const equityChange = portfolio.baseCapital > 0 ? ((portfolio.equity - portfolio.baseCapital) / portfolio.baseCapital) * 100 : 0;

  const metrics = [
    {
      title: "Total Equity",
      value: formatCurrency(portfolio.equity),
      change: formatPercentage(equityChange),
      isPositive: equityChange >= 0,
      icon: PieChart,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-500"
    },
    {
      title: "Available Balance",
      value: formatCurrency(portfolio.availableBalance),
      icon: DollarSign,
      bgColor: "bg-green-50",
      iconColor: "text-green-500"
    },
    {
      title: "Total P&L",
      value: formatCurrency(portfolio.totalPnL),
      change: formatPercentage((portfolio.totalPnL / portfolio.baseCapital) * 100),
      isPositive: portfolio.totalPnL >= 0,
      icon: portfolio.totalPnL >= 0 ? TrendingUp : TrendingDown,
      bgColor: portfolio.totalPnL >= 0 ? "bg-green-50" : "bg-red-50",
      iconColor: portfolio.totalPnL >= 0 ? "text-green-500" : "text-red-500"
    },
    {
      title: "Unrealized P&L",
      value: formatCurrency(totalUnrealizedPnL),
      isPositive: totalUnrealizedPnL >= 0,
      icon: totalUnrealizedPnL >= 0 ? TrendingUp : TrendingDown,
      bgColor: totalUnrealizedPnL >= 0 ? "bg-green-50" : "bg-red-50",
      iconColor: totalUnrealizedPnL >= 0 ? "text-green-500" : "text-red-500"
    },
    {
      title: "Win Rate",
      value: formatPercentage(modelPerformance.winRate * 100),
      icon: Target,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-500"
    },
    {
      title: "AI Confidence",
      value: prediction ? formatPercentage(prediction.confidence * 100) : "N/A",
      icon: Brain,
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {metrics.map((metric, index) => (
        <Card key={index} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className={`w-10 h-10 rounded-lg ${metric.bgColor} flex items-center justify-center mb-3`}>
              <metric.icon className={`h-5 w-5 ${metric.iconColor}`} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{metric.title}</p>
              <p className="text-lg font-bold">{metric.value}</p>
              {metric.change && (
                <p className={`text-xs ${metric.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {metric.change}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
