
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { SimplifiedTradingDashboard } from "@/components/SimplifiedTradingDashboard";
import { useTradingStore } from "@/stores/tradingStore";
import { useEffect } from "react";

const Index = () => {
  const {
    connect,
    disconnect,
  } = useBinanceWebSocket('btcusdt');

  // Initialize the trading system but don't use its fragmented state
  const {
    portfolio: legacyPortfolio,
    signals: legacySignals,
    getModelPerformance,
  } = useAdvancedTradingSystem(
    'btcusdt',
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
    const modelPerformance = getModelPerformance();
    if (modelPerformance) {
      updateModelPerformance(modelPerformance);
    }
  }, [getModelPerformance, updateModelPerformance]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SimplifiedTradingDashboard
        onConnect={connect}
        onDisconnect={disconnect}
      />
    </div>
  );
};

export default Index;
