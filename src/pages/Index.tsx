
import { useEnhancedBinanceWebSocket } from "@/hooks/useEnhancedBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { useEnhancedConfiguration } from "@/hooks/useEnhancedConfiguration";
import { SimplifiedTradingDashboard } from "@/components/SimplifiedTradingDashboard";
import { useTradingStore } from "@/stores/tradingStore";
import { useEffect } from "react";

const Index = () => {
  const { config } = useEnhancedConfiguration();
  const symbol = config?.defaultSymbol || 'btcusdt';
  
  const {
    connect,
    disconnect,
    connectionStats,
    priceMetrics,
    performanceMetrics
  } = useEnhancedBinanceWebSocket(symbol);

  // Initialize the trading system but don't use its fragmented state
  const {
    portfolio: legacyPortfolio,
    signals: legacySignals,
    getModelPerformance,
  } = useAdvancedTradingSystem(
    symbol,
    [], // Empty bids since we're using centralized store
    []  // Empty asks since we're using centralized store
  );

  const { updatePortfolio, addSignal, updateModelPerformance } = useTradingStore();

  // Sync legacy data with centralized store
  useEffect(() => {
    if (legacyPortfolio) {
      updatePortfolio(legacyPortfolio);
    }
  }, [legacyPortfolio, updatePortfolio]);

  useEffect(() => {
    if (legacySignals && legacySignals.length > 0) {
      const latestSignal = legacySignals[legacySignals.length - 1];
      addSignal(latestSignal);
    }
  }, [legacySignals, addSignal]);

  useEffect(() => {
    const legacyModelPerformance = getModelPerformance();
    if (legacyModelPerformance && legacyModelPerformance.realDataStats) {
      const compatiblePerformance = {
        totalTrades: legacyModelPerformance.realDataStats.totalTrades || 0,
        winRate: legacyModelPerformance.realDataStats.winRate || 0,
        sharpeRatio: legacyModelPerformance.realDataStats.sharpeRatio || 0,
        maxDrawdown: legacyModelPerformance.realDataStats.maxDrawdown || 0,
        profitFactor: legacyModelPerformance.realDataStats.profitFactor || 0,
        avgWin: legacyModelPerformance.realDataStats.avgReturn || 0,
        avgLoss: Math.abs(legacyModelPerformance.realDataStats.avgMAE || 0)
      };
      updateModelPerformance(compatiblePerformance);
    }
  }, [getModelPerformance, updateModelPerformance]);

  // Log enhanced metrics for debugging
  useEffect(() => {
    if (connectionStats || priceMetrics || performanceMetrics) {
      console.log('📊 Enhanced Metrics Update:', {
        connection: connectionStats,
        price: priceMetrics,
        performance: performanceMetrics
      });
    }
  }, [connectionStats, priceMetrics, performanceMetrics]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SimplifiedTradingDashboard
        onConnect={connect}
        onDisconnect={disconnect}
      />
      
      {/* Enhanced Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-6xl mx-auto mt-6 p-4 bg-white rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">🔧 Enhanced Debug Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-sm text-gray-600 mb-2">Connection Stats</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(connectionStats, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-gray-600 mb-2">Price Metrics</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(priceMetrics, null, 2)}
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium text-sm text-gray-600 mb-2">Performance</h4>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(performanceMetrics, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
