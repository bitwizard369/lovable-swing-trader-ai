
import { useState, useEffect, useCallback } from 'react';
import { Portfolio, Position, TradingConfig } from '@/types/trading';

const initialPortfolio: Portfolio = {
  totalBalance: 10000, // Starting with $10k demo balance
  availableBalance: 10000,
  positions: [],
  totalPnL: 0,
  dayPnL: 0,
  equity: 10000
};

const initialConfig: TradingConfig = {
  maxPositionSize: 1000, // Max $1k per position
  maxDailyLoss: 500, // Max $500 daily loss
  stopLossPercentage: 2, // 2% stop loss
  takeProfitPercentage: 4, // 4% take profit
  maxOpenPositions: 5, // Max 5 concurrent positions
  riskPerTrade: 100 // Risk $100 per trade
};

export const usePortfolio = () => {
  const [portfolio, setPortfolio] = useState<Portfolio>(initialPortfolio);
  const [config, setConfig] = useState<TradingConfig>(initialConfig);

  const updatePositionPrices = useCallback((symbol: string, currentPrice: number) => {
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(position => {
        if (position.symbol === symbol && position.status === 'OPEN') {
          const unrealizedPnL = position.side === 'BUY' 
            ? (currentPrice - position.entryPrice) * position.size
            : (position.entryPrice - currentPrice) * position.size;
          
          return {
            ...position,
            currentPrice,
            unrealizedPnL
          };
        }
        return position;
      })
    }));
  }, []);

  const addPosition = useCallback((position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>) => {
    const newPosition: Position = {
      ...position,
      id: Date.now().toString(),
      unrealizedPnL: 0,
      realizedPnL: 0,
      status: 'OPEN'
    };

    setPortfolio(prev => {
      const positionValue = newPosition.size * newPosition.entryPrice;
      return {
        ...prev,
        positions: [...prev.positions, newPosition],
        availableBalance: prev.availableBalance - positionValue
      };
    });

    return newPosition.id;
  }, []);

  const closePosition = useCallback((positionId: string, closePrice: number) => {
    setPortfolio(prev => {
      const position = prev.positions.find(p => p.id === positionId);
      if (!position) return prev;

      const realizedPnL = position.side === 'BUY'
        ? (closePrice - position.entryPrice) * position.size
        : (position.entryPrice - closePrice) * position.size;

      const positionValue = position.size * closePrice;

      return {
        ...prev,
        positions: prev.positions.map(p =>
          p.id === positionId
            ? { ...p, status: 'CLOSED' as const, realizedPnL, currentPrice: closePrice }
            : p
        ),
        availableBalance: prev.availableBalance + positionValue,
        totalPnL: prev.totalPnL + realizedPnL
      };
    });
  }, []);

  const canOpenPosition = useCallback((positionValue: number): boolean => {
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN').length;
    
    return (
      portfolio.availableBalance >= positionValue &&
      openPositions < config.maxOpenPositions &&
      positionValue <= config.maxPositionSize &&
      Math.abs(portfolio.dayPnL) < config.maxDailyLoss
    );
  }, [portfolio, config]);

  // Calculate total equity including unrealized PnL
  useEffect(() => {
    const totalUnrealizedPnL = portfolio.positions
      .filter(p => p.status === 'OPEN')
      .reduce((sum, p) => sum + p.unrealizedPnL, 0);

    setPortfolio(prev => ({
      ...prev,
      equity: prev.totalBalance + prev.totalPnL + totalUnrealizedPnL
    }));
  }, [portfolio.positions, portfolio.totalBalance, portfolio.totalPnL]);

  return {
    portfolio,
    config,
    updatePositionPrices,
    addPosition,
    closePosition,
    canOpenPosition,
    setConfig
  };
};
