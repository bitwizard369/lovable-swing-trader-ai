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

  const handleDepthUpdate = useCallback((data: BinanceDepthEvent) => {
    setLatestUpdate(data);
    
    // Update order book
    setOrderBook(prev => {
      const newBids = [...prev.bids];
      const newAsks = [...prev.asks];

      // Update bids
      data.b.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        const index = newBids.findIndex(bid => bid.price === priceNum);
        
        if (quantityNum === 0) {
          // Remove level if quantity is 0
          if (index !== -1) {
            newBids.splice(index, 1);
          }
        } else {
          // Update or add level
          if (index !== -1) {
            newBids[index].quantity = quantityNum;
          } else {
            newBids.push({ price: priceNum, quantity: quantityNum });
          }
        }
      });

      // Update asks
      data.a.forEach(([price, quantity]) => {
        const priceNum = parseFloat(price);
        const quantityNum = parseFloat(quantity);
        const index = newAsks.findIndex(ask => ask.price === priceNum);
        
        if (quantityNum === 0) {
          // Remove level if quantity is 0
          if (index !== -1) {
            newAsks.splice(index, 1);
          }
        } else {
          // Update or add level
          if (index !== -1) {
            newAsks[index].quantity = quantityNum;
          } else {
            newAsks.push({ price: priceNum, quantity: quantityNum });
          }
        }
      });

      // Sort order book
      newBids.sort((a, b) => b.price - a.price); // Descending for bids
      newAsks.sort((a, b) => a.price - b.price); // Ascending for asks

      // Keep only top 20 levels for performance
      return {
        bids: newBids.slice(0, 20),
        asks: newAsks.slice(0, 20),
        lastUpdateId: data.u
      };
    });
  }, []);

  const handleConnectionStatusChange = useCallback((status: boolean) => {
    setIsConnected(status);
  }, []);

  const connect = useCallback(() => {
    if (!wsService.current) {
      wsService.current = new BinanceWebSocketService(
        symbol,
        handleDepthUpdate,
        handleConnectionStatusChange
      );
    }
    wsService.current.connect();
  }, [symbol, handleDepthUpdate, handleConnectionStatusChange]);

  const disconnect = useCallback(() => {
    if (wsService.current) {
      wsService.current.disconnect();
    }
  }, []);

  const checkAPIHealth = useCallback(async () => {
    const healthy = await checkBinanceAPIHealth();
    setApiHealthy(healthy);
    return healthy;
  }, []);

  useEffect(() => {
    // Check API health on mount
    checkAPIHealth();

    // Auto-connect on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect, checkAPIHealth]);

  return {
    isConnected,
    orderBook,
    apiHealthy,
    latestUpdate,
    connect,
    disconnect,
    checkAPIHealth
  };
};
