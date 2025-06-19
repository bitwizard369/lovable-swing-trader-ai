
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedTradingDashboard } from "@/components/AdvancedTradingDashboard";
import { TradingSignals } from "@/components/TradingSignals";
import { OrderBook } from "@/components/OrderBook";
import { Brain, BarChart3, BookOpen } from "lucide-react";

interface DashboardTabsProps {
  // AI Trading props
  indicators: any;
  marketContext: any;
  prediction: any;
  modelPerformance: any;
  onConfigUpdate: (config: any) => void;
  
  // Classic Trading props
  signals: any[];
  latestSignal: any;
  orderBook: any;
  isConnected: boolean;
  symbol: string;
  
  // Technical Analysis props
  basicIndicators: any;
  advancedIndicators: any;
}

export const DashboardTabs = ({
  indicators,
  marketContext,
  prediction,
  modelPerformance,
  onConfigUpdate,
  signals,
  latestSignal,
  orderBook,
  isConnected,
  symbol,
  basicIndicators,
  advancedIndicators
}: DashboardTabsProps) => {
  return (
    <Tabs defaultValue="ai-trading" className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="ai-trading" className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          AI Trading
        </TabsTrigger>
        <TabsTrigger value="classic" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Classic View
        </TabsTrigger>
        <TabsTrigger value="analysis" className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Technical Analysis
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ai-trading" className="space-y-6">
        <AdvancedTradingDashboard
          indicators={indicators}
          marketContext={marketContext}
          prediction={prediction}
          modelPerformance={modelPerformance}
          onConfigUpdate={onConfigUpdate}
        />
      </TabsContent>

      <TabsContent value="classic" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <OrderBook
              bids={orderBook.bids}
              asks={orderBook.asks}
              symbol={symbol}
              isConnected={isConnected}
            />
          </div>
          <div className="lg:col-span-2">
            <TradingSignals
              signals={signals}
              latestSignal={latestSignal}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="analysis" className="space-y-6">
        {/* Technical Indicators Display */}
        {basicIndicators && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border rounded-lg bg-muted/50">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">RSI</p>
              <p className={`font-mono ${basicIndicators.rsi > 70 ? 'text-red-500' : basicIndicators.rsi < 30 ? 'text-green-500' : 'text-foreground'}`}>
                {basicIndicators.rsi.toFixed(2)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">EMA Fast</p>
              <p className="font-mono">${basicIndicators.ema_fast.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">EMA Slow</p>
              <p className="font-mono">${basicIndicators.ema_slow.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">MACD</p>
              <p className={`font-mono ${basicIndicators.macd > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {basicIndicators.macd.toFixed(4)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Signal</p>
              <p className="font-mono">{basicIndicators.signal.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* Advanced Indicators Grid */}
        {advancedIndicators && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">SMA 9</p>
              <p className="font-mono text-sm">${advancedIndicators.sma_9.toFixed(2)}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">SMA 21</p>
              <p className="font-mono text-sm">${advancedIndicators.sma_21.toFixed(2)}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Stoch %K</p>
              <p className="font-mono text-sm">{advancedIndicators.stoch_k.toFixed(1)}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Williams %R</p>
              <p className="font-mono text-sm">{advancedIndicators.williams_r.toFixed(1)}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">ATR</p>
              <p className="font-mono text-sm">{advancedIndicators.atr.toFixed(2)}</p>
            </div>
            <div className="p-4 border rounded-lg text-center">
              <p className="text-xs text-muted-foreground">Volume Ratio</p>
              <p className="font-mono text-sm">{advancedIndicators.volume_ratio.toFixed(2)}</p>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
