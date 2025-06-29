
import { useEffect } from 'react';
import { useTradingStore } from '@/stores/tradingStore';

export const usePriceStaleness = (staleThresholdMs: number = 10000) => {
  const { priceData, setPriceStale } = useTradingStore();

  useEffect(() => {
    if (!priceData) return;

    const checkStaleness = () => {
      const now = Date.now();
      const isStale = now - priceData.timestamp > staleThresholdMs;
      setPriceStale(isStale);
    };

    // Check immediately
    checkStaleness();

    // Set up interval to check staleness
    const interval = setInterval(checkStaleness, 5000);

    return () => clearInterval(interval);
  }, [priceData?.timestamp, staleThresholdMs, setPriceStale]);
};
