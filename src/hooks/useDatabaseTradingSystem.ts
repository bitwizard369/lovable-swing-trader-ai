
import { useState, useEffect, useCallback } from 'react';
import { Portfolio, Position, TradingSignal } from '@/types/trading';
import { DatabaseTradingService } from '@/services/databaseTradingService';

interface TradingSystemConfig {
  symbol: string;
  initialBalance: number;
  maxPositions: number;
  riskPerTrade: number;
}

export const useDatabaseTradingSystem = (config: TradingSystemConfig) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const tradingService = DatabaseTradingService.getInstance();

  // Initialize the trading system
  const initialize = useCallback(async () => {
    setIsLoading(true);
    
    try {
      console.log('[DB Trading Hook] 🚀 Initializing database trading system...');
      
      const sessionId = await tradingService.initializeSession(
        config.symbol,
        config.initialBalance,
        {
          maxPositions: config.maxPositions,
          riskPerTrade: config.riskPerTrade
        }
      );

      if (sessionId) {
        setSessionId(sessionId);
        
        // Get initial portfolio state
        const initialPortfolio = await tradingService.getPortfolio();
        if (initialPortfolio) {
          setPortfolio(initialPortfolio);
        }
        
        setIsInitialized(true);
        console.log('[DB Trading Hook] ✅ Database trading system initialized');
      } else {
        console.error('[DB Trading Hook] ❌ Failed to initialize trading system');
      }
    } catch (error) {
      console.error('[DB Trading Hook] Error initializing:', error);
    } finally {
      setIsLoading(false);
    }
  }, [config.symbol, config.initialBalance, config.maxPositions, config.riskPerTrade]);

  // Subscribe to portfolio updates
  useEffect(() => {
    if (!isInitialized) return;

    const unsubscribe = tradingService.subscribe((updatedPortfolio) => {
      console.log('[DB Trading Hook] 📊 Portfolio updated:', updatedPortfolio.equity);
      setPortfolio(updatedPortfolio);
    });

    return unsubscribe;
  }, [isInitialized]);

  // Execute trading signal
  const executeSignal = useCallback(async (signal: TradingSignal, prediction?: any): Promise<boolean> => {
    if (!isInitialized || !portfolio) {
      console.error('[DB Trading Hook] System not initialized');
      return false;
    }

    try {
      console.log(`[DB Trading Hook] 📈 Executing ${signal.action} signal for ${signal.symbol}`);
      
      // Save signal to database
      await tradingService.saveSignal(signal, prediction);

      if (signal.action === 'BUY' || signal.action === 'SELL') {
        // Create position
        const position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'> = {
          symbol: signal.symbol,
          side: signal.action,
          size: signal.quantity,
          entryPrice: signal.price,
          currentPrice: signal.price,
          timestamp: signal.timestamp
        };

        const addedPosition = await tradingService.addPosition(position);
        
        if (addedPosition) {
          console.log(`[DB Trading Hook] ✅ Position created: ${addedPosition.id}`);
          return true;
        } else {
          console.error('[DB Trading Hook] ❌ Failed to create position');
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[DB Trading Hook] Error executing signal:', error);
      return false;
    }
  }, [isInitialized, portfolio]);

  // Update position prices
  const updatePositionPrices = useCallback(async (priceUpdates: { [symbol: string]: number }) => {
    if (!isInitialized || !portfolio) return;

    try {
      const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
      
      for (const position of openPositions) {
        const currentPrice = priceUpdates[position.symbol];
        if (currentPrice && currentPrice !== position.currentPrice) {
          
          // Calculate unrealized P&L
          const priceChange = currentPrice - position.entryPrice;
          const unrealizedPnL = position.side === 'BUY' 
            ? priceChange * position.size
            : -priceChange * position.size;

          await tradingService.updatePosition(position.id, {
            currentPrice,
            unrealizedPnL
          });
        }
      }
    } catch (error) {
      console.error('[DB Trading Hook] Error updating position prices:', error);
    }
  }, [isInitialized, portfolio]);

  // Close position
  const closePosition = useCallback(async (positionId: string, closePrice: number): Promise<boolean> => {
    if (!isInitialized) return false;

    try {
      console.log(`[DB Trading Hook] 🔒 Closing position: ${positionId} at ${closePrice}`);
      
      const success = await tradingService.closePosition(positionId, closePrice);
      
      if (success) {
        console.log(`[DB Trading Hook] ✅ Position closed: ${positionId}`);
      } else {
        console.error(`[DB Trading Hook] ❌ Failed to close position: ${positionId}`);
      }
      
      return success;
    } catch (error) {
      console.error('[DB Trading Hook] Error closing position:', error);
      return false;
    }
  }, [isInitialized]);

  // End session
  const endSession = useCallback(async (): Promise<boolean> => {
    if (!isInitialized) return false;

    try {
      console.log('[DB Trading Hook] 🛑 Ending trading session...');
      
      const success = await tradingService.endSession();
      
      if (success) {
        setIsInitialized(false);
        setSessionId(null);
        setPortfolio(null);
        console.log('[DB Trading Hook] ✅ Session ended');
      }
      
      return success;
    } catch (error) {
      console.error('[DB Trading Hook] Error ending session:', error);
      return false;
    }
  }, [isInitialized]);

  return {
    portfolio,
    isLoading,
    isInitialized,
    sessionId,
    initialize,
    executeSignal,
    updatePositionPrices,
    closePosition,
    endSession,
    isUsingRealData: () => true
  };
};
