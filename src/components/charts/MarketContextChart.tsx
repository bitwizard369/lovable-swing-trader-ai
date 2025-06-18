
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MarketContext, AdvancedIndicators } from "@/services/advancedTechnicalAnalysis";

interface MarketContextChartProps {
  marketContext: MarketContext | null;
  indicators: AdvancedIndicators | null;
}

const chartConfig = {
  value: {
    label: "Market Strength",
    color: "hsl(var(--chart-1))",
  },
};

export const MarketContextChart = ({ marketContext, indicators }: MarketContextChartProps) => {
  if (!marketContext || !indicators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No market data available</p>
        </CardContent>
      </Card>
    );
  }

  // Create radar chart data from indicators
  const radarData = [
    {
      indicator: 'RSI',
      value: indicators.rsi_14 / 100,
      fullMark: 1,
    },
    {
      indicator: 'Trend',
      value: indicators.trend_strength / 100,
      fullMark: 1,
    },
    {
      indicator: 'Volatility',
      value: Math.min(indicators.atr / 100, 1),
      fullMark: 1,
    },
    {
      indicator: 'Volume',
      value: Math.min(indicators.volume_ratio / 2, 1),
      fullMark: 1,
    },
    {
      indicator: 'Momentum',
      value: Math.abs(indicators.macd) / 0.01,
      fullMark: 1,
    },
    {
      indicator: 'Stochastic',
      value: indicators.stoch_k / 100,
      fullMark: 1,
    },
  ];

  const getVolatilityColor = (regime: string | undefined) => {
    if (!regime) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    switch (regime) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMarketRegimeColor = (regime: string | undefined) => {
    if (!regime) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    if (regime.includes('BULL')) return 'bg-green-100 text-green-800 border-green-200';
    if (regime.includes('BEAR')) return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Market Context & Technical Strength
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Volatility</p>
            <Badge className={getVolatilityColor(marketContext.volatilityRegime)}>
              {marketContext.volatilityRegime || 'UNKNOWN'}
            </Badge>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Market Regime</p>
            <Badge className={getMarketRegimeColor(marketContext.marketRegime)}>
              {marketContext.marketRegime ? marketContext.marketRegime.replace(/_/g, ' ') : 'UNKNOWN'}
            </Badge>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Market Hour</p>
            <Badge variant="outline">{marketContext.marketHour || 'UNKNOWN'}</Badge>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">News Impact</p>
            <Badge variant="secondary">{marketContext.newsImpact || 'UNKNOWN'}</Badge>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[300px]">
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="indicator" fontSize={12} />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 1]} 
              fontSize={10}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            />
            <Radar
              name="Market Strength"
              dataKey="value"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-md">
                      <p className="font-semibold">{data.indicator}</p>
                      <p className="text-sm">Strength: {(data.value * 100).toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ChartContainer>

        <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <p className="text-muted-foreground">RSI (14)</p>
            <p className={`font-mono ${indicators.rsi_14 > 70 ? 'text-red-500' : indicators.rsi_14 < 30 ? 'text-green-500' : ''}`}>
              {indicators.rsi_14.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">ATR</p>
            <p className="font-mono">{indicators.atr.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Trend Strength</p>
            <p className="font-mono">{indicators.trend_strength.toFixed(1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
