
import { useState, useEffect, useCallback } from "react";
import { EnhancedDashboard } from "@/components/EnhancedDashboard";
import { useBinanceWebSocket } from "@/hooks/useBinanceWebSocket";
import { useAdvancedTradingSystem } from "@/hooks/useAdvancedTradingSystem";
import { useTradingSessionPersistence } from "@/hooks/useTradingSessionPersistence";
import { useToast } from "@/components/ui/use-toast";
import { Portfolio } from "@/types/trading";

const Index = () => {
  const { toast } = useToast();
  const [isSystemInitialized, setIsSystemInitialized] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);

  // WebSocket connection
  const {
    isConnected,
    orderBook,
    latestUpdate,
    apiHealthy,
    connect,
    disconnect,
    checkAPIHealth,
  } = useBinanceWebSocket('btcusdt');

  // Database persistence with enhanced config
  const persistence = useTradingSessionPersistence({
    symbol: 'btcusdt',
    autoSave: true,
    saveInterval: 5000,
    snapshotInterval: 30000,
    healthCheckInterval: 60000, // Check health every minute
  });

  // Trading system
  const tradingSystem = useAdvancedTradingSystem({
    symbol: 'btcusdt',
    initialBalance: 10000,
    maxPositions: 100,
    riskPerTrade: 0.02,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.04,
    trailingStopPercent: 0.015,
    persistence,
  });

  // Initialize system with proper error handling
  const initializeSystem = useCallback(async () => {
    if (!persistence.isAuthenticated) {
      console.log('[System] Waiting for authentication...');
      return;
    }

    try {
      setSystemError(null);
      console.log('[System] 🚀 Initializing trading system with database persistence...');

      // Initialize trading session with database
      const session = await persistence.initializeSession(
        tradingSystem.portfolio,
        tradingSystem.config
      );

      if (session) {
        console.log(`[System] ✅ Session initialized: ${session.id}`);
        
        // If we have recovered data, apply it to the trading system
        if (persistence.recoveredData) {
          console.log('[System] 🔄 Applying recovered portfolio data...');
          
          // Force the trading system to use the recovered portfolio
          tradingSystem.setPortfolio(persistence.recoveredData.portfolio);
          
          // Sync positions with recovered data
          persistence.recoveredData.positions.forEach(position => {
            tradingSystem.syncPosition(position);
          });

          toast({
            title: 'Portfolio Recovered',
            description: `Loaded ${persistence.recoveredData.positions.length} positions with equity: $${persistence.recoveredData.portfolio.equity.toFixed(2)}`,
            variant: 'default'
          });
        } else {
          console.log('[System] 📊 Starting with fresh portfolio state');
        }

        setIsSystemInitialized(true);
        
        // Connect to WebSocket after system is ready
        if (!isConnected) {
          connect();
        }

        console.log('[System] ✅ System initialization completed successfully');
      } else {
        throw new Error('Failed to initialize trading session');
      }
    } catch (error) {
      console.error('[System] ❌ Failed to initialize system:', error);
      setSystemError(error instanceof Error ? error.message : 'Unknown initialization error');
      
      toast({
        title: 'System Initialization Failed',
        description: 'Failed to initialize trading system with database',
        variant: 'destructive'
      });
    }
  }, [persistence.isAuthenticated, persistence.initializeSession, persistence.recoveredData, tradingSystem, connect, isConnected, toast]);

  // Initialize system when authentication is ready
  useEffect(() => {
    if (persistence.isAuthenticated && !isSystemInitialized && !persistence.isRecovering) {
      initializeSystem();
    }
  }, [persistence.isAuthenticated, isSystemInitialized, persistence.isRecovering, initializeSystem]);

  // Auto-save portfolio state to database
  useEffect(() => {
    if (isSystemInitialized && persistence.currentSession) {
      persistence.savePortfolioState(tradingSystem.portfolio);
    }
  }, [tradingSystem.portfolio, isSystemInitialized, persistence.currentSession, persistence.savePortfolioState]);

  // Handle position lifecycle events with database sync
  useEffect(() => {
    if (!isSystemInitialized || !persistence.currentSession) return;

    const handlePositionOpened = (position: any) => {
      console.log('[System] 📍 Syncing new position to database:', position.id);
      persistence.savePosition(position);
    };

    const handlePositionUpdated = (positionId: string, updates: any) => {
      console.log('[System] 📊 Syncing position update to database:', positionId);
      persistence.updatePosition(positionId, updates);
    };

    const handlePositionClosed = (positionId: string, exitPrice: number, realizedPnL: number) => {
      console.log('[System] 🔒 Syncing position closure to database:', positionId);
      persistence.closePosition(positionId, exitPrice, realizedPnL);
    };

    // Subscribe to trading system events
    tradingSystem.on('positionOpened', handlePositionOpened);
    tradingSystem.on('positionUpdated', handlePositionUpdated);
    tradingSystem.on('positionClosed', handlePositionClosed);

    return () => {
      tradingSystem.off('positionOpened', handlePositionOpened);
      tradingSystem.off('positionUpdated', handlePositionUpdated);
      tradingSystem.off('positionClosed', handlePositionClosed);
    };
  }, [isSystemInitialized, persistence.currentSession, tradingSystem, persistence.savePosition, persistence.updatePosition, persistence.closePosition]);

  // Handle market data updates
  useEffect(() => {
    if (isSystemInitialized && latestUpdate && latestUpdate.c) {
      const price = parseFloat(latestUpdate.c);
      const volume = parseFloat(latestUpdate.v || '0');
      
      tradingSystem.updatePrice(price, volume);
    }
  }, [latestUpdate, isSystemInitialized, tradingSystem.updatePrice]);

  // Show loading state
  if (!persistence.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">AI Trading Bot</div>
          <div className="text-lg">Please sign in to continue...</div>
        </div>
      </div>
    );
  }

  if (persistence.isRecovering) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Recovering Trading Session...</div>
          <div className="text-lg">Loading portfolio and position data from database</div>
        </div>
      </div>
    );
  }

  if (systemError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4 text-red-400">System Error</div>
          <div className="text-lg mb-4">{systemError}</div>
          <button 
            onClick={initializeSystem}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  if (!isSystemInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-2xl font-bold mb-4">Initializing Trading System...</div>
          <div className="text-lg">Setting up database connection and portfolio state</div>
        </div>
      </div>
    );
  }

  return (
    <EnhancedDashboard
      // WebSocket props
      isConnected={isConnected}
      orderBook={orderBook}
      apiHealthy={apiHealthy}
      latestUpdate={latestUpdate}
      connect={connect}
      disconnect={disconnect}
      checkAPIHealth={checkAPIHealth}
      
      // Trading system props
      portfolio={tradingSystem.portfolio}
      indicators={tradingSystem.indicators}
      marketContext={tradingSystem.marketContext}
      prediction={tradingSystem.prediction}
      activePositions={tradingSystem.activePositions}
      config={tradingSystem.config}
      updateConfig={tradingSystem.updateConfig}
      getModelPerformance={tradingSystem.getModelPerformance}
      signals={tradingSystem.signals}
      latestSignal={tradingSystem.latestSignal}
      basicIndicators={tradingSystem.basicIndicators}
    />
  );
};

export default Index;
