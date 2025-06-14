
import { useState, useEffect, useCallback } from 'react';
import { TradingSignal } from '@/types/trading';

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface TechnicalIndicators {
  rsi: number;
  ema_fast: number;
  ema_slow: number;
  macd: number;
  signal: number;
  volume_ratio: number;
}

export const useTradingSignals = (symbol: string, bids: OrderBookLevel[], asks: OrderBookLevel[]) => {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  const calculateIndicators = useCallback((prices: number[]): TechnicalIndicators | null => {
    if (prices.length < 20) return null;

    // Simple RSI calculation (14-period)
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = losses.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Simple EMA calculation
    const ema_fast = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const ema_slow = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;

    // Basic MACD
    const macd = ema_fast - ema_slow;
    const signal = macd * 0.8; // Simplified signal line

    return {
      rsi,
      ema_fast,
      ema_slow,
      macd,
      signal,
      volume_ratio: 1.0 // Placeholder
    };
  }, []);

  const generateSignal = useCallback((currentPrice: number, indicators: TechnicalIndicators): TradingSignal | null => {
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reasoning = '';

    // Trading logic based on technical indicators
    if (indicators.rsi < 30 && indicators.macd > indicators.signal && indicators.ema_fast > indicators.ema_slow) {
      action = 'BUY';
      confidence = 0.75;
      reasoning = 'Oversold RSI with bullish MACD crossover and EMA trend';
    } else if (indicators.rsi > 70 && indicators.macd < indicators.signal && indicators.ema_fast < indicators.ema_slow) {
      action = 'SELL';
      confidence = 0.75;
      reasoning = 'Overbought RSI with bearish MACD crossover and EMA trend';
    } else if (indicators.macd > indicators.signal && indicators.ema_fast > indicators.ema_slow) {
      action = 'BUY';
      confidence = 0.5;
      reasoning = 'Bullish MACD crossover with upward EMA trend';
    } else if (indicators.macd < indicators.signal && indicators.ema_fast < indicators.ema_slow) {
      action = 'SELL';
      confidence = 0.5;
      reasoning = 'Bearish MACD crossover with downward EMA trend';
    }

    if (action === 'HOLD') return null;

    // Calculate position size based on confidence and risk
    const baseQuantity = 0.01; // 0.01 BTC
    const quantity = baseQuantity * confidence;

    return {
      symbol,
      action,
      confidence,
      price: currentPrice,
      quantity,
      timestamp: Date.now(),
      reasoning
    };
  }, [symbol]);

  // Update price history and generate signals
  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      
      setPriceHistory(prev => {
        const newHistory = [...prev, midPrice].slice(-100); // Keep last 100 prices
        
        const newIndicators = calculateIndicators(newHistory);
        setIndicators(newIndicators);
        
        if (newIndicators) {
          const signal = generateSignal(midPrice, newIndicators);
          if (signal) {
            setSignals(prev => [...prev.slice(-9), signal]); // Keep last 10 signals
          }
        }
        
        return newHistory;
      });
    }
  }, [bids, asks, calculateIndicators, generateSignal]);

  const getLatestSignal = useCallback(() => {
    return signals.length > 0 ? signals[signals.length - 1] : null;
  }, [signals]);

  return {
    signals,
    indicators,
    latestSignal: getLatestSignal(),
    priceHistory
  };
};
