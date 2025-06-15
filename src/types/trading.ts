export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING';
}

export interface Portfolio {
  baseCapital: number;
  availableBalance: number;
  lockedProfits: number;
  positions: Position[];
  totalPnL: number;
  dayPnL: number;
  equity: number;
}

export interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  quantity: number;
  timestamp: number;
  reasoning: string;
}

export interface RiskMetrics {
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export interface TradingConfig {
  maxPositionSize: number;
  maxDailyLoss: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxOpenPositions: number;
  riskPerTrade: number;
}
