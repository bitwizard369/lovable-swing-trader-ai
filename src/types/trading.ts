
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

export interface TechnicalIndicators {
  sma_9: number;
  sma_21: number;
  ema_12: number;
  ema_26: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  rsi_14: number;
  stoch_k: number;
  stoch_d: number;
  williams_r: number;
  bollinger_upper: number;
  bollinger_middle: number;
  bollinger_lower: number;
  atr: number;
  volume_sma: number;
  volume_ratio: number;
  vwap: number;
  support_level: number;
  resistance_level: number;
  trend_strength: number;
  orderbook_pressure: number;
  rsi?: number; // Legacy support
}

export interface MarketContext {
  volatilityRegime: 'LOW' | 'MEDIUM' | 'HIGH';
  marketRegime: 'STRONG_BULL' | 'WEAK_BULL' | 'STRONG_BEAR' | 'WEAK_BEAR' | 'SIDEWAYS_VOLATILE' | 'SIDEWAYS_QUIET';
  marketHour: 'LONDON' | 'NEW_YORK' | 'ASIA' | 'OVERLAP' | 'LOW_LIQUIDITY';
  newsImpact: 'HIGH' | 'MEDIUM' | 'LOW';
  liquidityScore: number;
  spreadQuality: number;
  trend?: string; // Legacy support
  volatility?: number; // Legacy support
  momentum?: number; // Legacy support
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
