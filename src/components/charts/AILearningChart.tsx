
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Brain, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AILearningChartProps {
  data: Array<{
    timestamp: number;
    winRate: number;
    confidence: number;
    sharpeRatio: number;
    totalTrades: number;
  }>;
  currentMetrics: {
    winRate: number;
    confidence: number;
    totalTrades: number;
    sharpeRatio: number;
  };
}

const chartConfig = {
  winRate: {
    label: "Win Rate %",
    color: "hsl(var(--chart-1))",
  },
  confidence: {
    label: "Confidence %",
    color: "hsl(var(--chart-2))",
  },
  sharpeRatio: {
    label: "Sharpe Ratio",
    color: "hsl(var(--chart-3))",
  },
};

export const AILearningChart = ({ data, currentMetrics }: AILearningChartProps) => {
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-500" />
          AI Learning Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">Win Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-500">
              {formatPercent(currentMetrics.winRate)}
            </div>
            <Progress value={currentMetrics.winRate * 100} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="text-sm font-medium">Confidence</span>
            </div>
            <div className="text-2xl font-bold">
              {formatPercent(currentMetrics.confidence)}
            </div>
            <Progress value={currentMetrics.confidence * 100} className="h-2" />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Total Trades</span>
            <div className="text-2xl font-bold">{currentMetrics.totalTrades}</div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Sharpe Ratio</span>
            <div className={`text-2xl font-bold ${currentMetrics.sharpeRatio > 1 ? 'text-green-500' : 'text-yellow-500'}`}>
              {currentMetrics.sharpeRatio.toFixed(2)}
            </div>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[250px]">
          <LineChart data={data}>
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              fontSize={12}
            />
            <YAxis 
              domain={[0, 1]}
              tickFormatter={formatPercent}
              fontSize={12}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              labelFormatter={formatTime}
            />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="var(--color-winRate)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="confidence"
              stroke="var(--color-confidence)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
