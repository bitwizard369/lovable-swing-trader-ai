
import { useState, useEffect } from 'react';
import { UnifiedPriceService } from '@/services/unifiedPriceService';

interface PriceData {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  symbol: string;
}

export const useUnifiedPrice = (symbol?: string) => {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const priceService = UnifiedPriceService.getInstance(symbol);
    
    // Get current price immediately
    const currentPrice = priceService.getCurrentPrice();
    if (currentPrice) {
      setPriceData(currentPrice);
    }

    // Subscribe to price updates
    const unsubscribe = priceService.subscribe((newPriceData) => {
      setPriceData(newPriceData);
      setIsStale(false);
    });

    // Set up staleness detection (if no updates for 10 seconds, mark as stale)
    const staleTimer = setInterval(() => {
      if (priceData && Date.now() - priceData.timestamp > 10000) {
        setIsStale(true);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(staleTimer);
    };
  }, [symbol, priceData?.timestamp]);

  return {
    priceData,
    isStale,
    // Convenience getters
    currentPrice: priceData?.mid || 0,
    bid: priceData?.bid || 0,
    ask: priceData?.ask || 0,
    spread: priceData?.spread || 0,
    lastUpdate: priceData?.timestamp || 0
  };
};
