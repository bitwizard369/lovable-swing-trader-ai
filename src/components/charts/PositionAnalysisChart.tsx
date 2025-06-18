
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { PieChart as PieChartIcon, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PositionAnalysisChartProps {
  positions: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    unrealizedPnL: number;
    size: number;
    entryTime: number;
    prediction?: {
      confidence: number;
      expectedReturn: number;
      riskScore: number;
    };
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const PositionAnalysisChart = ({ positions }: PositionAnalysisChartProps) => {
  // Group positions by symbol for pie chart
  const symbolData = positions.reduce((acc, pos) => {
    if (!acc[pos.symbol]) {
      acc[pos.symbol] = { count: 0, totalPnL: 0, totalSize: 0 };
    }
    acc[pos.symbol].count += 1;
    acc[pos.symbol].totalPnL += pos.unrealizedPnL;
    acc[pos.symbol].totalSize += Math.abs(pos.size);
    return acc;
  }, {} as Record<string, { count: number; totalPnL: number; totalSize: number }>);

  const pieData = Object.entries(symbolData).map(([symbol, data]) => ({
    name: symbol.toUpperCase(),
    value: data.count,
    pnl: data.totalPnL,
    size: data.totalSize,
  }));

  // P&L distribution data with color information
  const pnlData = positions.map((pos, index) => ({
    id: pos.id.substring(0, 8),
    symbol: pos.symbol.toUpperCase(),
    pnl: pos.unrealizedPnL,
    confidence: pos.prediction?.confidence || 0,
    risk: pos.prediction?.riskScore || 0,
    fill: pos.unrealizedPnL >= 0 ? '#10b981' : '#ef4444', // Green for profit, red for loss
  }));

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  const chartConfig = {
    pnl: {
      label: "P&L",
      color: "hsl(var(--chart-1))",
    },
    confidence: {
      label: "Confidence",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Position Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Position Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-md">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-sm">Positions: {data.value}</p>
                        <p className="text-sm">Total P&L: {formatCurrency(data.pnl)}</p>
                        <p className="text-sm">Total Size: {data.size.toFixed(6)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ChartContainer>
          
          <div className="flex flex-wrap gap-2 mt-4">
            {pieData.map((entry, index) => (
              <Badge key={entry.name} variant="outline" className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                {entry.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* P&L Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            P&L Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <BarChart data={pnlData}>
              <XAxis 
                dataKey="symbol" 
                fontSize={12}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                fontSize={12}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name) => [
                  name === 'pnl' ? formatCurrency(Number(value)) : `${(Number(value) * 100).toFixed(1)}%`,
                  name === 'pnl' ? 'P&L' : 'Confidence'
                ]}
              />
              <Bar
                dataKey="pnl"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ChartContainer>

          <div className="mt-4 text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>Total Positions: {positions.length}</span>
              <span>
                Total P&L: {formatCurrency(positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0))}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
