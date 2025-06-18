
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfitabilityChart } from "@/components/charts/ProfitabilityChart";
import { AILearningChart } from "@/components/charts/AILearningChart";
import { PositionAnalysisChart } from "@/components/charts/PositionAnalysisChart";
import { MarketContextChart } from "@/components/charts/MarketContextChart";
import { RealTimeMetricsChart } from "@/components/charts/RealTimeMetricsChart";
import { WebSocketStatus } from "@/components/WebSocketStatus";
import { Portfolio } from "@/components/Portfolio";
import { TradingSignals } from "@/components/TradingSignals";
import { AdvancedTradingDashboard } from "@/components/AdvancedTradingDashboard";
import { BarChart3, Brain, TrendingUp, Activity, Target } from "lucide-react";
import { useState, useEffect } from "react";

interface EnhancedDashboardProps {
  // WebSocket data
  isConnected: boolean;
  orderBook: { bids: any[]; asks: any[] };
  apiHealthy: boolean | null;
  latestUpdate: any;
  connect: () => void;
  disconnect: () => void;
  checkAPIHealth: () => void;

  // Trading system data
  portfolio: any;
  indicators: any;
  marketContext: any;
  prediction: any;
  activePositions: any[];
  config: any;
  updateConfig: (config: any) => void;
  getModelPerformance: () => any;
  signals: any[];
  latestSignal: any;
  basicIndicators: any;
}

export const EnhancedDashboard = ({
  isConnected,
  orderBook,
  apiHealthy,
  latestUpdate,
  connect,
  disconnect,
  checkAPIHealth,
  portfolio,
  indicators,
  marketContext,
  prediction,
  activePositions,
  config,
  updateConfig,
  getModelPerformance,
  signals,
  latestSignal,
  basicIndicators,
}: EnhancedDashboardProps) => {
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [learningData, setLearningData] = useState<any[]>([]);

  const modelPerformance = getModelPerformance();

  // Simulate historical data collection
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Add profitability data
      if (portfolio) {
        setHistoricalData(prev => {
          const newPoint = {
            timestamp: now,
            totalPnL: portfolio.totalPnL,
            dayPnL: portfolio.dayPnL || 0,
            equity: portfolio.equity,
            winRate: modelPerformance.winRate,
          };
          return [...prev.slice(-50), newPoint]; // Keep last 50 points
        });
      }

      // Add learning progress data
      if (modelPerformance) {
        setLearningData(prev => {
          const newPoint = {
            timestamp: now,
            winRate: modelPerformance.winRate,
            confidence: prediction?.confidence || 0.5,
            sharpeRatio: modelPerformance.sharpeRatio,
            totalTrades: modelPerformance.totalTrades,
          };
          return [...prev.slice(-50), newPoint]; // Keep last 50 points
        });
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [portfolio, modelPerformance, prediction]);

  // Transform positions for chart component
  const chartPositions = activePositions.map(item => ({
    id: item.position.id,
    symbol: item.position.symbol,
    side: item.position.side,
    unrealizedPnL: item.position.unrealizedPnL,
    size: item.position.size,
    entryTime: item.entryTime,
    prediction: item.prediction,
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">AI Trading Bot Dashboard</h1>
          <p className="text-xl text-muted-foreground">Advanced Machine Learning Trading System with Visual Analytics</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Learning
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="positions" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="realtime" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Real-Time
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <WebSocketStatus
                  isConnected={isConnected}
                  apiHealthy={apiHealthy}
                  latestUpdate={latestUpdate}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  onCheckHealth={checkAPIHealth}
                />
              </div>
              <div className="lg:col-span-3">
                <ProfitabilityChart data={historicalData} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MarketContextChart marketContext={marketContext} indicators={indicators} />
              <Portfolio portfolio={portfolio} activePositions={activePositions} />
            </div>
          </TabsContent>

          <TabsContent value="learning" className="space-y-6">
            <AILearningChart 
              data={learningData} 
              currentMetrics={{
                winRate: modelPerformance.winRate,
                confidence: prediction?.confidence || 0.5,
                totalTrades: modelPerformance.totalTrades,
                sharpeRatio: modelPerformance.sharpeRatio,
              }}
            />
            
            <AdvancedTradingDashboard
              indicators={indicators}
              marketContext={marketContext}
              prediction={prediction}
              modelPerformance={modelPerformance}
              onConfigUpdate={updateConfig}
            />
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <ProfitabilityChart data={historicalData} />
            <TradingSignals signals={signals} latestSignal={latestSignal} />
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <PositionAnalysisChart positions={chartPositions} />
            <Portfolio portfolio={portfolio} activePositions={activePositions} />
          </TabsContent>

          <TabsContent value="realtime" className="space-y-6">
            <RealTimeMetricsChart
              isConnected={isConnected}
              latestUpdate={latestUpdate}
              orderBookDepth={{
                bids: orderBook.bids.length,
                asks: orderBook.asks.length,
              }}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WebSocketStatus
                isConnected={isConnected}
                apiHealthy={apiHealthy}
                latestUpdate={latestUpdate}
                onConnect={connect}
                onDisconnect={disconnect}
                onCheckHealth={checkAPIHealth}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Live Market Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Order Book Depth:</span>
                      <span>{orderBook.bids.length + orderBook.asks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bids:</span>
                      <span className="text-green-500">{orderBook.bids.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Asks:</span>
                      <span className="text-red-500">{orderBook.asks.length}</span>
                    </div>
                    {latestUpdate && (
                      <>
                        <div className="flex justify-between">
                          <span>Last Update:</span>
                          <span>{new Date(latestUpdate.E).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Symbol:</span>
                          <span>{latestUpdate.s?.toUpperCase()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
