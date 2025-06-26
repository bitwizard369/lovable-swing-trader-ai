
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
  const wsService = useRef<BinanceWebSocketService | null>(null);
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);

  // Debounced update handler to prevent excessive re-renders
  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    const now = Date.now();
    updateCountRef.current++;
    
    // Limit update frequency to prevent browser overload
    if (now - lastUpdateTimeRef.current < 100) { // Max 10 updates per second
      return;
    }
    
    lastUpdateTimeRef.current = now;
    setLatestUpdate(data);
    
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
      console.log(`📊 Performance: ${updateCountRef.current} updates processed`);
    }
  }, []);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    setIsConnected(status);
    if (!status) {
      console.log('🔌 Connection lost - clearing stale data');
      // Clear stale data when disconnected
      setLatestUpdate(null);
    }
  }, []);

  const connect = useCallback(() => {
    console.log('🔄 Establishing WebSocket connection...');
    
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
    updateCountRef.current = 0;
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
    console.log('🚀 Initializing WebSocket connection...');
    
    // Check API health on mount
    checkAPIHealth();

    // Auto-connect with delay to prevent immediate reconnection loops
    const connectTimer = setTimeout(() => {
      connect();
    }, 1000);

    // Cleanup function with proper resource management
    return () => {
      console.log('🧹 Cleaning up WebSocket resources...');
      clearTimeout(connectTimer);
      
      if (wsService.current) {
        wsService.current.cleanup();
        wsService.current = null;
      }
      
      // Reset all state
      setIsConnected(false);
      setOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
      setLatestUpdate(null);
      setApiHealthy(null);
      updateCountRef.current = 0;
    };
  }, [connect, checkAPIHealth]);

  // Performance monitoring
  useEffect(() => {
    const performanceTimer = setInterval(() => {
      if (updateCountRef.current > 0) {
        console.log(`📈 WebSocket Performance: ${updateCountRef.current} updates, Connected: ${isConnected}`);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(performanceTimer);
  }, [isConnected]);

  return {
    isConnected,
    orderBook,
    apiHealthy,
    latestUpdate,
    connect,
    disconnect,
    checkAPIHealth,
    // Add performance metrics for debugging
    updateCount: updateCountRef.current,
    connectionStable: isConnected && updateCountRef.current > 0
  };
};
