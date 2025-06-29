
import { useState, useEffect, useRef, useCallback } from 'react';
import { BinanceWebSocketService, checkBinanceAPIHealth } from '@/services/binanceWebSocket';
import { useTradingStore } from '@/stores/tradingStore';

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
  const [latestUpdate, setLatestUpdate] = useState<BinanceDepthEvent | null>(null);
  const wsService = useRef<BinanceWebSocketService | null>(null);
  const updateCountRef = useRef(0);
  const lastUpdateTimeRef = useRef(0);

  // Use centralized store
  const { 
    updateOrderBook, 
    updateWebSocketState, 
    webSocket: { isConnected, apiHealthy } 
  } = useTradingStore();

  // Debounced update handler to prevent excessive re-renders
  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    const now = Date.now();
    updateCountRef.current++;
    
    // Limit update frequency to prevent browser overload
    if (now - lastUpdateTimeRef.current < 100) {
      return;
    }
    
    lastUpdateTimeRef.current = now;
    setLatestUpdate(data);
    
    // Update order book with memory management
    const newBids: OrderBookLevel[] = [];
    const newAsks: OrderBookLevel[] = [];

    // Process bid updates
    data.b.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      if (quantityNum > 0) {
        newBids.push({ price: priceNum, quantity: quantityNum });
      }
    });

    // Process ask updates
    data.a.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      if (quantityNum > 0) {
        newAsks.push({ price: priceNum, quantity: quantityNum });
      }
    });

    // Sort and limit to prevent memory bloat
    newBids.sort((a, b) => b.price - a.price);
    newAsks.sort((a, b) => a.price - b.price);

    const updatedOrderBook = {
      bids: newBids.slice(0, 20),
      asks: newAsks.slice(0, 20),
      lastUpdateId: data.u
    };

    // Update the centralized store
    updateOrderBook(updatedOrderBook);
    updateWebSocketState({ updateCount: updateCountRef.current });

    // Log performance metrics every 100 updates
    if (updateCountRef.current % 100 === 0) {
      console.log(`📊 Performance: ${updateCountRef.current} updates processed`);
    }
  }, [updateOrderBook, updateWebSocketState]);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    updateWebSocketState({ isConnected: status });
    if (!status) {
      console.log('🔌 Connection lost - clearing stale data');
      setLatestUpdate(null);
    }
  }, [updateWebSocketState]);

  const connect = useCallback(() => {
    console.log('🔄 Establishing WebSocket connection...');
    
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
    
    updateOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
    setLatestUpdate(null);
    updateCountRef.current = 0;
    updateWebSocketState({ 
      isConnected: false, 
      updateCount: 0,
      connectionStable: false 
    });
  }, [updateOrderBook, updateWebSocketState]);

  const checkAPIHealth = useCallback(async () => {
    console.log('🏥 Checking API health...');
    const healthy = await checkBinanceAPIHealth();
    updateWebSocketState({ apiHealthy: healthy });
    
    if (!healthy) {
      console.error('❌ API unhealthy - consider reconnecting');
    }
    
    return healthy;
  }, [updateWebSocketState]);

  useEffect(() => {
    console.log('🚀 Initializing WebSocket connection...');
    
    checkAPIHealth();

    const connectTimer = setTimeout(() => {
      connect();
    }, 1000);

    return () => {
      console.log('🧹 Cleaning up WebSocket resources...');
      clearTimeout(connectTimer);
      
      if (wsService.current) {
        wsService.current.cleanup();
        wsService.current = null;
      }
      
      updateWebSocketState({ 
        isConnected: false,
        apiHealthy: null,
        updateCount: 0,
        connectionStable: false
      });
      setLatestUpdate(null);
      updateCountRef.current = 0;
    };
  }, [connect, checkAPIHealth, updateWebSocketState]);

  // Performance monitoring
  useEffect(() => {
    const performanceTimer = setInterval(() => {
      if (updateCountRef.current > 0) {
        console.log(`📈 WebSocket Performance: ${updateCountRef.current} updates, Connected: ${isConnected}`);
        updateWebSocketState({ connectionStable: isConnected && updateCountRef.current > 0 });
      }
    }, 30000);

    return () => clearInterval(performanceTimer);
  }, [isConnected, updateWebSocketState]);

  return {
    isConnected,
    orderBook: { bids: [], asks: [], lastUpdateId: 0 }, // Legacy compatibility
    apiHealthy,
    latestUpdate,
    connect,
    disconnect,
    checkAPIHealth,
    updateCount: updateCountRef.current,
    connectionStable: isConnected && updateCountRef.current > 0
  };
};
