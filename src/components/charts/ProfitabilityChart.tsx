
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, DollarSign } from "lucide-react";

interface ProfitabilityChartProps {
  data: Array<{
    timestamp: number;
    totalPnL: number;
    dayPnL: number;
    equity: number;
    winRate: number;
  }>;
}

const chartConfig = {
  totalPnL: {
    label: "Total P&L",
    color: "hsl(var(--chart-1))",
  },
  equity: {
    label: "Equity",
    color: "hsl(var(--chart-2))",
  },
  dayPnL: {
    label: "Daily P&L",
    color: "hsl(var(--chart-3))",
  },
};

export const ProfitabilityChart = ({ data }: ProfitabilityChartProps) => {
  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  const latestData = data[data.length - 1];
  const previousData = data[data.length - 2];
  const equityChange = latestData && previousData ? 
    ((latestData.equity - previousData.equity) / previousData.equity) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Portfolio Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current Equity</p>
            <p className="text-2xl font-bold">{latestData ? formatCurrency(latestData.equity) : '$0.00'}</p>
            <p className={`text-sm ${equityChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {equityChange >= 0 ? '+' : ''}{equityChange.toFixed(2)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total P&L</p>
            <p className={`text-2xl font-bold ${latestData && latestData.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {latestData ? formatCurrency(latestData.totalPnL) : '$0.00'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Today's P&L</p>
            <p className={`text-2xl font-bold ${latestData && latestData.dayPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {latestData ? formatCurrency(latestData.dayPnL) : '$0.00'}
            </p>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[300px]">
          <AreaChart data={data}>
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatCurrency}
              fontSize={12}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              labelFormatter={formatTime}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="var(--color-equity)"
              fill="var(--color-equity)"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="totalPnL"
              stroke="var(--color-totalPnL)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
