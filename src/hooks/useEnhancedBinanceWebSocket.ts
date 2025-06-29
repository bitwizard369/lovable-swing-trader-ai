
import { useState, useEffect, useRef, useCallback } from 'react';
import { EnhancedBinanceWebSocketService, checkEnhancedBinanceAPIHealth } from '@/services/enhancedBinanceWebSocket';
import { EnhancedUnifiedPriceService } from '@/services/enhancedUnifiedPriceService';
import { EnhancedConfigurationService } from '@/services/enhancedConfigurationService';
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

interface BinanceTradeEvent {
  e: string;
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  b: number;
  a: number;
  T: number;
  m: boolean;
  M: boolean;
}

interface BinanceTickerEvent {
  e: string;
  E: number;
  s: string;
  p: string;
  P: string;
  w: string;
  x: string;
  c: string;
  Q: string;
  b: string;
  B: string;
  a: string;
  A: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
  O: number;
  C: number;
  F: number;
  L: number;
  n: number;
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

export const useEnhancedBinanceWebSocket = (symbol: string = 'btcusdt') => {
  const [connectionStats, setConnectionStats] = useState<any>(null);
  const [priceMetrics, setPriceMetrics] = useState<any>(null);
  
  const wsService = useRef<EnhancedBinanceWebSocketService | null>(null);
  const priceService = useRef<EnhancedUnifiedPriceService | null>(null);
  const configService = useRef<EnhancedConfigurationService | null>(null);
  
  const updateCountRef = useRef(0);
  const performanceMetrics = useRef({
    startTime: Date.now(),
    totalMessages: 0,
    avgProcessingTime: 0,
    lastBenchmark: Date.now()
  });

  // Use centralized store
  const { 
    updateOrderBook, 
    updateWebSocketState,
    updatePriceData,
    webSocket: { isConnected, apiHealthy } 
  } = useTradingStore();

  // Initialize services
  useEffect(() => {
    configService.current = EnhancedConfigurationService.getInstance();
    priceService.current = EnhancedUnifiedPriceService.getInstance(symbol);
    
    return () => {
      if (priceService.current) {
        priceService.current.cleanup();
      }
    };
  }, [symbol]);

  // Enhanced depth update handler with performance optimization
  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    const startTime = performance.now();
    updateCountRef.current++;
    
    // Update order book with enhanced processing
    const newBids: OrderBookLevel[] = [];
    const newAsks: OrderBookLevel[] = [];

    // Process bid updates with validation
    data.b.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      // Enhanced validation
      if (quantityNum > 0 && priceNum > 0 && !isNaN(priceNum) && !isNaN(quantityNum)) {
        newBids.push({ price: priceNum, quantity: quantityNum });
      }
    });

    // Process ask updates with validation
    data.a.forEach(([price, quantity]) => {
      const priceNum = parseFloat(price);
      const quantityNum = parseFloat(quantity);
      
      if (quantityNum > 0 && priceNum > 0 && !isNaN(priceNum) && !isNaN(quantityNum)) {
        newAsks.push({ price: priceNum, quantity: quantityNum });
      }
    });

    // Sort and limit based on configuration
    const config = configService.current?.getConfiguration();
    const depthLimit = config?.orderBookDepthLimit || 20;
    
    newBids.sort((a, b) => b.price - a.price);
    newAsks.sort((a, b) => a.price - b.price);

    const updatedOrderBook = {
      bids: newBids.slice(0, depthLimit),
      asks: newAsks.slice(0, depthLimit),
      lastUpdateId: data.u
    };

    // Update centralized store
    updateOrderBook(updatedOrderBook);
    
    // Update price service if we have valid bid/ask
    if (newBids.length > 0 && newAsks.length > 0 && priceService.current) {
      const priceData = {
        bid: newBids[0].price,
        ask: newAsks[0].price,
        mid: (newBids[0].price + newAsks[0].price) / 2,
        spread: newAsks[0].price - newBids[0].price,
        timestamp: Date.now(),
        symbol: symbol.toUpperCase()
      };
      
      priceService.current.updatePrice(priceData, 'websocket');
      updatePriceData(priceData);
    }

    // Update performance metrics
    const processingTime = performance.now() - startTime;
    performanceMetrics.current.totalMessages++;
    performanceMetrics.current.avgProcessingTime = 
      (performanceMetrics.current.avgProcessingTime * 0.9) + (processingTime * 0.1);

    // Update WebSocket state
    updateWebSocketState({ updateCount: updateCountRef.current });

    // Log performance every 500 updates
    if (updateCountRef.current % 500 === 0) {
      console.log(`📊 Enhanced Performance: ${updateCountRef.current} updates, avg processing: ${performanceMetrics.current.avgProcessingTime.toFixed(2)}ms`);
    }
  }, [updateOrderBook, updateWebSocketState, updatePriceData, symbol]);

  // Enhanced trade update handler
  const handleTradeUpdate = useCallback((data: BinanceTradeEvent) => {
    // Update price service with trade data
    if (priceService.current) {
      const tradePrice = parseFloat(data.p);
      const currentPrice = priceService.current.getCurrentPrice();
      
      // Use trade price to update mid price
      if (currentPrice) {
        const updatedPrice = {
          ...currentPrice,
          mid: tradePrice,
          timestamp: Date.now()
        };
        priceService.current.updatePrice(updatedPrice, 'websocket');
        updatePriceData(updatedPrice);
      }
    }
    
    // Could add trade signal analysis here
    console.log(`📈 Trade: ${data.p} @ ${data.q}`);
  }, [updatePriceData]);

  // Enhanced ticker update handler
  const handleTickerUpdate = useCallback((data: BinanceTickerEvent) => {
    // Update price service with comprehensive ticker data
    if (priceService.current) {
      const priceData = {
        bid: parseFloat(data.b),
        ask: parseFloat(data.a),
        mid: parseFloat(data.c),
        spread: parseFloat(data.a) - parseFloat(data.b),
        timestamp: Date.now(),
        symbol: symbol.toUpperCase(),
        volume: parseFloat(data.v),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        change24h: parseFloat(data.p),
        changePercent24h: parseFloat(data.P)
      };
      
      priceService.current.updatePrice(priceData, 'websocket');
      updatePriceData(priceData);
    }
  }, [updatePriceData, symbol]);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    updateWebSocketState({ isConnected: status });
    
    if (!status) {
      console.log('🔌 Enhanced connection lost - maintaining price service');
    } else {
      console.log('✅ Enhanced connection established');
    }
  }, [updateWebSocketState]);

  const handleError = useCallback((error: string) => {
    console.error('❌ Enhanced WebSocket Error:', error);
    updateWebSocketState({ apiHealthy: false });
  }, [updateWebSocketState]);

  const connect = useCallback(() => {
    console.log('🔄 Establishing Enhanced WebSocket connection...');
    
    if (wsService.current) {
      wsService.current.cleanup();
    }
    
    // Get WebSocket configuration
    const config = configService.current?.getWebSocketConfig() || {};
    
    wsService.current = new EnhancedBinanceWebSocketService(
      symbol,
      {
        onDepthUpdate: handleDepthUpdate,
        onTradeUpdate: handleTradeUpdate,
        onTickerUpdate: handleTickerUpdate,
        onConnectionStatusChange: handleConnectionStatusChange,
        onError: handleError
      },
      {
        maxReconnectAttempts: config.wsReconnectAttempts,
        messageThrottleMs: config.wsMessageThrottleMs,
        heartbeatIntervalMs: config.wsHeartbeatIntervalMs
      }
    );
    
    wsService.current.connect();
  }, [symbol, handleDepthUpdate, handleTradeUpdate, handleTickerUpdate, handleConnectionStatusChange, handleError]);

  const disconnect = useCallback(() => {
    console.log('🛑 Manually disconnecting Enhanced WebSocket...');
    
    if (wsService.current) {
      wsService.current.cleanup();
      wsService.current = null;
    }
    
    updateOrderBook({ bids: [], asks: [], lastUpdateId: 0 });
    updateCountRef.current = 0;
    updateWebSocketState({ 
      isConnected: false, 
      updateCount: 0,
      connectionStable: false 
    });
  }, [updateOrderBook, updateWebSocketState]);

  const checkAPIHealth = useCallback(async () => {
    console.log('🏥 Checking Enhanced API health...');
    const healthy = await checkEnhancedBinanceAPIHealth();
    updateWebSocketState({ apiHealthy: healthy });
    
    if (!healthy) {
      console.error('❌ Enhanced API unhealthy - consider reconnecting');
    }
    
    return healthy;
  }, [updateWebSocketState]);

  // Initialize connection
  useEffect(() => {
    console.log('🚀 Initializing Enhanced WebSocket connection...');
    
    checkAPIHealth();

    // Auto-connect based on configuration
    const config = configService.current?.getConfiguration();
    if (config?.autoConnect) {
      const connectTimer = setTimeout(() => {
        connect();
      }, 1000);

      return () => clearTimeout(connectTimer);
    }
  }, [connect, checkAPIHealth]);

  // Performance monitoring and metrics collection
  useEffect(() => {
    const metricsTimer = setInterval(() => {
      if (wsService.current) {
        setConnectionStats(wsService.current.getConnectionStats());
      }
      
      if (priceService.current) {
        setPriceMetrics(priceService.current.getMetrics());
      }
      
      // Update connection stability
      const isStable = isConnected && updateCountRef.current > 0;
      updateWebSocketState({ connectionStable: isStable });
      
    }, 10000); // Every 10 seconds

    return () => clearInterval(metricsTimer);
  }, [isConnected, updateWebSocketState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up Enhanced WebSocket resources...');
      
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
      updateCountRef.current = 0;
    };
  }, [updateWebSocketState]);

  return {
    isConnected,
    apiHealthy,
    connect,
    disconnect,
    checkAPIHealth,
    updateCount: updateCountRef.current,
    connectionStable: isConnected && updateCountRef.current > 0,
    connectionStats,
    priceMetrics,
    performanceMetrics: performanceMetrics.current
  };
};
