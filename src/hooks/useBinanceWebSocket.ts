
import { useState, useEffect, useRef, useCallback } from 'react';
import { BinanceWebSocketService, checkBinanceAPIHealth } from '@/services/binanceWebSocket';

interface BinanceDepthEvent {
  e: string;
  E: number;
  s: string;
  U: number;
  u: number;
  b: [string, string][];
  a: [string, string][];
}

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
}

export const useBinanceWebSocket = (symbol: string = 'btcusdt') => {
  const [isConnected, setIsConnected] = useState(false);
  const [orderBook, setOrderBook] = useState<OrderBook>({ bids: [], asks: [], lastUpdateId: 0 });
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [latestUpdate, setLatestUpdate] = useState<BinanceDepthEvent | null>(null);
  const [connectionStable, setConnectionStable] = useState(false);
  const wsService = useRef<BinanceWebSocketService | null>(null);
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);
  const connectionQualityRef = useRef({ 
    lastDataTime: 0, 
    updateCount: 0, 
    staleDataThreshold: 30000 // 30 seconds
  });

  // Enhanced connection quality monitoring
  const checkConnectionQuality = useCallback(() => {
    const now = Date.now();
    const timeSinceLastData = now - connectionQualityRef.current.lastDataTime;
    const isStale = timeSinceLastData > connectionQualityRef.current.staleDataThreshold;
    
    setConnectionStable(isConnected && !isStale && updateCountRef.current > 0);
    
    if (isStale && isConnected) {
      console.log(`🔌 Connection quality degraded - ${timeSinceLastData/1000}s since last update`);
    }
  }, [isConnected]);

  // Debounced update handler to prevent excessive re-renders
  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    const now = Date.now();
    updateCountRef.current++;
    connectionQualityRef.current.lastDataTime = now;
    connectionQualityRef.current.updateCount++;
    
    // Limit update frequency to prevent browser overload
    if (now - lastUpdateTimeRef.current < 100) { // Max 10 updates per second
      return;
    }
    
    lastUpdateTimeRef.current = now;
    setLatestUpdate(data);
    
    console.log(`📊 WebSocket Update #${updateCountRef.current} - Price data received, connection stable`);
    
    // Update order book with memory management
    setOrderBook(prev => {
      const newBids = [...prev.bids];
      const newAsks = [...prev.asks];

      // Process bid updates
      data.b.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        const index = newBids.findIndex(bid => bid.price === priceNum);
        
        if (quantityNum === 0) {
          if (index !== -1) {
            newBids.splice(index, 1);
          }
        } else {
          if (index !== -1) {
            newBids[index].quantity = quantityNum;
          } else {
            newBids.push({ price: priceNum, quantity: quantityNum });
          }
        }
      });

      // Process ask updates
      data.a.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        const index = newAsks.findIndex(ask => ask.price === priceNum);
        
        if (quantityNum === 0) {
          if (index !== -1) {
            newAsks.splice(index, 1);
          }
        } else {
          if (index !== -1) {
            newAsks[index].quantity = quantityNum;
          } else {
            newAsks.push({ price: priceNum, quantity: quantityNum });
          }
        }
      });

      // Sort and limit to prevent memory bloat
      newBids.sort((a, b) => b.price - a.price);
      newAsks.sort((a, b) => a.price - b.price);

      return {
        bids: newBids.slice(0, 20), // Strict memory limit
        asks: newAsks.slice(0, 20), // Strict memory limit
        lastUpdateId: data.u
      };
    });

    // Log performance metrics every 100 updates
    if (updateCountRef.current % 100 === 0) {
      console.log(`📊 Performance: ${updateCountRef.current} updates processed, Quality score: ${connectionStable ? 'GOOD' : 'DEGRADED'}`);
    }
  }, [connectionStable]);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    console.log(`🔌 Connection status changed: ${status ? 'CONNECTED' : 'DISCONNECTED'}`);
    setIsConnected(status);
    
    if (!status) {
      console.log('🔌 Connection lost - clearing stale data and resetting quality metrics');
      setLatestUpdate(null);
      setConnectionStable(false);
      connectionQualityRef.current = { 
        lastDataTime: 0, 
        updateCount: 0, 
        staleDataThreshold: 30000 
      };
    } else {
      connectionQualityRef.current.lastDataTime = Date.now();
    }
  }, []);

  const connect = useCallback(() => {
    console.log('🔄 Establishing WebSocket connection with enhanced monitoring...');
    
    // Clean up existing connection
    if (wsService.current) {
      wsService.current.cleanup();
    }
    
    wsService.current = new BinanceWebSocketService(
      symbol,
      handleDepthUpdate,
      handleConnectionStatusChange
    );
    
    wsService.current.connect();
  }, [symbol, handleDepthUpdate, handleConnectionStatusChange]);

  const disconnect = useCallback(() => {
    console.log('🛑 Manually disconnecting WebSocket...');
    if (wsService.current) {
      wsService.current.cleanup();
      wsService.current = null;
    }
    
    // Reset state
    setOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
    setLatestUpdate(null);
    setConnectionStable(false);
    updateCountRef.current = 0;
    connectionQualityRef.current = { 
      lastDataTime: 0, 
      updateCount: 0, 
      staleDataThreshold: 30000 
    };
  }, []);

  const checkAPIHealth = useCallback(async () => {
    console.log('🏥 Checking API health...');
    const healthy = await checkBinanceAPIHealth();
    setApiHealthy(healthy);
    
    if (!healthy) {
      console.error('❌ API unhealthy - consider reconnecting');
    }
    
    return healthy;
  }, []);

  useEffect(() => {
    console.log('🚀 Initializing enhanced WebSocket connection...');
    
    // Check API health on mount
    checkAPIHealth();

    // Auto-connect with delay to prevent immediate reconnection loops
    const connectTimer = setTimeout(() => {
      connect();
    }, 1000);

    // Set up connection quality monitoring
    const qualityCheckInterval = setInterval(checkConnectionQuality, 5000); // Check every 5 seconds

    // Cleanup function with proper resource management
    return () => {
      console.log('🧹 Cleaning up enhanced WebSocket resources...');
      clearTimeout(connectTimer);
      clearInterval(qualityCheckInterval);
      
      if (wsService.current) {
        wsService.current.cleanup();
        wsService.current = null;
      }
      
      // Reset all state
      setIsConnected(false);
      setOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
      setLatestUpdate(null);
      setApiHealthy(null);
      setConnectionStable(false);
      updateCountRef.current = 0;
    };
  }, [connect, checkAPIHealth, checkConnectionQuality]);

  // Performance monitoring
  useEffect(() => {
    const performanceTimer = setInterval(() => {
      if (updateCountRef.current > 0) {
        const qualityScore = connectionStable ? 'EXCELLENT' : isConnected ? 'DEGRADED' : 'OFFLINE';
        console.log(`📈 WebSocket Performance: ${updateCountRef.current} updates, Status: ${qualityScore}`);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(performanceTimer);
  }, [isConnected, connectionStable]);

  return {
    isConnected,
    orderBook,
    apiHealthy,
    latestUpdate,
    connect,
    disconnect,
    checkAPIHealth,
    // Enhanced performance metrics for debugging
    updateCount: updateCountRef.current,
    connectionStable,
    connectionQuality: connectionQualityRef.current
  };
};
