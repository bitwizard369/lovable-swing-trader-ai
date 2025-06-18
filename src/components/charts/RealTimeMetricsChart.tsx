
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { Activity, Zap, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface RealTimeMetricsChartProps {
  isConnected: boolean;
  latestUpdate: any;
  orderBookDepth: { bids: number; asks: number };
}

interface MetricPoint {
  timestamp: number;
  latency: number;
  orderBookDepth: number;
  updateRate: number;
}

const chartConfig = {
  latency: {
    label: "Latency (ms)",
    color: "hsl(var(--chart-1))",
  },
  orderBookDepth: {
    label: "Order Book Depth",
    color: "hsl(var(--chart-2))",
  },
  updateRate: {
    label: "Updates/sec",
    color: "hsl(var(--chart-3))",
  },
};

export const RealTimeMetricsChart = ({ isConnected, latestUpdate, orderBookDepth }: RealTimeMetricsChartProps) => {
  const [metricsData, setMetricsData] = useState<MetricPoint[]>([]);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastSecond, setLastSecond] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (latestUpdate) {
      const now = Date.now();
      const currentSecond = Math.floor(now / 1000);
      
      if (currentSecond !== lastSecond) {
        // New second, calculate updates per second
        const newMetric: MetricPoint = {
          timestamp: now,
          latency: now - latestUpdate.E, // Simple latency approximation
          orderBookDepth: orderBookDepth.bids + orderBookDepth.asks,
          updateRate: updateCount,
        };

        setMetricsData(prev => {
          const updated = [...prev, newMetric];
          return updated.slice(-60); // Keep last 60 seconds
        });

        setUpdateCount(1);
        setLastSecond(currentSecond);
      } else {
        setUpdateCount(prev => prev + 1);
      }
    }
  }, [latestUpdate, orderBookDepth, lastSecond, updateCount]);

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();
  
  const currentMetrics = metricsData.length > 0 ? metricsData[metricsData.length - 1] : null;
  const avgLatency = metricsData.length > 0 ? 
    metricsData.reduce((sum, m) => sum + m.latency, 0) / metricsData.length : 0;
  const avgUpdateRate = metricsData.length > 0 ? 
    metricsData.reduce((sum, m) => sum + m.updateRate, 0) / metricsData.length : 0;

  const getLatencyStatus = (latency: number) => {
    if (latency < 50) return { color: 'text-green-500', status: 'Excellent' };
    if (latency < 100) return { color: 'text-yellow-500', status: 'Good' };
    return { color: 'text-red-500', status: 'Poor' };
  };

  const latencyStatus = currentMetrics ? getLatencyStatus(currentMetrics.latency) : { color: 'text-gray-500', status: 'Unknown' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Real-Time Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Connection</span>
            </div>
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Latency</span>
            </div>
            <div className={`text-lg font-bold ${latencyStatus.color}`}>
              {currentMetrics ? `${currentMetrics.latency.toFixed(0)}ms` : '--'}
            </div>
            <div className="text-xs text-muted-foreground">{latencyStatus.status}</div>
          </div>

          <div className="text-center">
            <span className="text-sm font-medium">Updates/sec</span>
            <div className="text-lg font-bold">
              {currentMetrics ? currentMetrics.updateRate : 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg: {avgUpdateRate.toFixed(1)}
            </div>
          </div>

          <div className="text-center">
            <span className="text-sm font-medium">Order Book</span>
            <div className="text-lg font-bold">
              {orderBookDepth.bids + orderBookDepth.asks}
            </div>
            <div className="text-xs text-muted-foreground">
              {orderBookDepth.bids}B / {orderBookDepth.asks}A
            </div>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[200px]">
          <LineChart data={metricsData}>
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatTime}
              fontSize={12}
            />
            <YAxis 
              fontSize={12}
              domain={[0, 'dataMax + 10']}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              labelFormatter={formatTime}
            />
            <Line
              type="monotone"
              dataKey="latency"
              stroke="var(--color-latency)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="updateRate"
              stroke="var(--color-updateRate)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>

        <div className="mt-4 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Avg Latency: {avgLatency.toFixed(1)}ms</span>
            <span>Data Points: {metricsData.length}/60</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
