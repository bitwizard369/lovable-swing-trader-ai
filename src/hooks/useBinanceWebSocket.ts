
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
  const priceUpdateTimestampRef = useRef(0);

  // Enhanced update handler with better price sync validation
  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    const now = Date.now();
    updateCountRef.current++;
    priceUpdateTimestampRef.current = now;
    
    // Limit update frequency to prevent browser overload
    if (now - lastUpdateTimeRef.current < 100) { // Max 10 updates per second
      return;
    }
    
    lastUpdateTimeRef.current = now;
    setLatestUpdate(data);
    
    console.log(`📈 [Binance.US] Price update received: ${data.b.length} bids, ${data.a.length} asks, Update ID: ${data.u}`);
    
    // Update order book with enhanced validation
    setOrderBook(prev => {
      const newBids = [...prev.bids];
      const newAsks = [...prev.asks];

      // Process bid updates with validation
      data.b.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        
        // Validate price data
        if (isNaN(priceNum) || priceNum <= 0) {
          console.warn('⚠️ Invalid bid price received:', price);
          return;
        }
        
        const index = newBids.findIndex(bid => bid.price === priceNum);
        
        if (quantityNum === 0) {
          if (index !== -1) {
            newBids.splice(index, 1);
          }
        } else {
          if (isNaN(quantityNum) || quantityNum < 0) {
            console.warn('⚠️ Invalid bid quantity received:', quantity);
            return;
          }
          
          if (index !== -1) {
            newBids[index].quantity = quantityNum;
          } else {
            newBids.push({ price: priceNum, quantity: quantityNum });
          }
        }
      });

      // Process ask updates with validation
      data.a.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        
        // Validate price data
        if (isNaN(priceNum) || priceNum <= 0) {
          console.warn('⚠️ Invalid ask price received:', price);
          return;
        }
        
        const index = newAsks.findIndex(ask => ask.price === priceNum);
        
        if (quantityNum === 0) {
          if (index !== -1) {
            newAsks.splice(index, 1);
          }
        } else {
          if (isNaN(quantityNum) || quantityNum < 0) {
            console.warn('⚠️ Invalid ask quantity received:', quantity);
            return;
          }
          
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

      const updatedOrderBook = {
        bids: newBids.slice(0, 20),
        asks: newAsks.slice(0, 20),
        lastUpdateId: data.u
      };

      // Log current best prices for verification
      const bestBid = updatedOrderBook.bids[0]?.price;
      const bestAsk = updatedOrderBook.asks[0]?.price;
      if (bestBid && bestAsk) {
        const currentPrice = (bestBid + bestAsk) / 2;
        console.log(`💰 [Binance.US] Current Price: $${currentPrice.toFixed(2)} (Bid: $${bestBid.toFixed(2)}, Ask: $${bestAsk.toFixed(2)})`);
      }

      return updatedOrderBook;
    });

    // Log performance metrics every 50 updates
    if (updateCountRef.current % 50 === 0) {
      console.log(`📊 [Performance] ${updateCountRef.current} price updates processed from Binance.US`);
    }
  }, []);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    setIsConnected(status);
    console.log(`🔌 [Binance.US] Connection status: ${status ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    if (!status) {
      console.log('🔌 Connection lost - clearing stale price data');
      setLatestUpdate(null);
    }
  }, []);

  const connect = useCallback(() => {
    console.log('🔄 [Binance.US] Establishing WebSocket connection for price sync...');
    
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
    console.log('🛑 [Binance.US] Manually disconnecting price feed...');
    if (wsService.current) {
      wsService.current.cleanup();
      wsService.current = null;
    }
    
    // Reset state
    setOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
    setLatestUpdate(null);
    updateCountRef.current = 0;
    priceUpdateTimestampRef.current = 0;
  }, []);

  const checkAPIHealth = useCallback(async () => {
    console.log('🏥 [Binance.US] Checking API health for price sync...');
    const healthy = await checkBinanceAPIHealth();
    setApiHealthy(healthy);
    
    if (!healthy) {
      console.error('❌ [Binance.US] API unhealthy - price sync may be affected');
    } else {
      console.log('✅ [Binance.US] API healthy - price sync should work normally');
    }
    
    return healthy;
  }, []);

  useEffect(() => {
    console.log('🚀 [Binance.US] Initializing price synchronization system...');
    
    // Check API health on mount
    checkAPIHealth();

    // Auto-connect with delay to prevent immediate reconnection loops
    const connectTimer = setTimeout(() => {
      connect();
    }, 1000);

    // Price staleness monitor
    const staleCheckTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - priceUpdateTimestampRef.current;
      
      if (isConnected && timeSinceLastUpdate > 10000) { // 10 seconds without updates
        console.warn('⚠️ [Binance.US] Price data may be stale - no updates for', timeSinceLastUpdate / 1000, 'seconds');
      }
    }, 5000);

    // Cleanup function with proper resource management
    return () => {
      console.log('🧹 [Binance.US] Cleaning up price sync resources...');
      clearTimeout(connectTimer);
      clearInterval(staleCheckTimer);
      
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
      priceUpdateTimestampRef.current = 0;
    };
  }, [connect, checkAPIHealth]);

  // Performance monitoring with price sync focus
  useEffect(() => {
    const performanceTimer = setInterval(() => {
      if (updateCountRef.current > 0) {
        const timeSinceLastUpdate = Date.now() - priceUpdateTimestampRef.current;
        console.log(`📈 [Binance.US Price Sync] Updates: ${updateCountRef.current}, Connected: ${isConnected}, Last Update: ${timeSinceLastUpdate}ms ago`);
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
    // Enhanced debugging info for price sync
    updateCount: updateCountRef.current,
    connectionStable: isConnected && updateCountRef.current > 0,
    lastPriceUpdateTime: priceUpdateTimestampRef.current,
    isPriceDataFresh: Date.now() - priceUpdateTimestampRef.current < 10000 // Fresh if updated within 10 seconds
  };
};
