
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Portfolio, Position, TradingSignal } from '@/types/trading';

interface PriceData {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  timestamp: number;
  symbol: string;
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

interface TradingConfiguration {
  maxPositionSize: number;
  positionSizePercentage: number;
  maxOpenPositions: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxDailyLoss: number;
  riskPerTrade: number;
  minProbability: number;
  minConfidence: number;
  useKellyCriterion: boolean;
  adaptiveEntryThreshold: boolean;
  atrBasedTrailingStop: boolean;
  initialBalance: number;
}

interface WebSocketState {
  isConnected: boolean;
  apiHealthy: boolean | null;
  latestUpdate: any;
  connectionStable: boolean;
  updateCount: number;
}

interface ModelPerformance {
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

interface TradingState {
  // Price Data
  priceData: PriceData | null;
  isPriceStale: boolean;
  orderBook: OrderBook;
  
  // Portfolio
  portfolio: Portfolio;
  
  // Configuration
  config: TradingConfiguration | null;
  
  // WebSocket Connection
  webSocket: WebSocketState;
  
  // Trading Signals
  signals: TradingSignal[];
  
  // Model Performance
  modelPerformance: ModelPerformance;
  
  // Actions
  updatePriceData: (priceData: PriceData) => void;
  setPriceStale: (isStale: boolean) => void;
  updateOrderBook: (orderBook: OrderBook) => void;
  updatePortfolio: (portfolio: Portfolio) => void;
  updateConfiguration: (config: Partial<TradingConfiguration>) => void;
  setConfiguration: (config: TradingConfiguration) => void;
  updateWebSocketState: (state: Partial<WebSocketState>) => void;
  addSignal: (signal: TradingSignal) => void;
  clearSignals: () => void;
  updateModelPerformance: (performance: Partial<ModelPerformance>) => void;
  
  // Computed values
  getCurrentPrice: () => number;
  getBidAskSpread: () => number;
  getEquityChange: () => number;
  getOpenPositions: () => Position[];
  getTotalUnrealizedPnL: () => number;
}

const DEFAULT_CONFIG: TradingConfiguration = {
  maxPositionSize: 5000,
  positionSizePercentage: 50,
  maxOpenPositions: 5,
  stopLossPercentage: 0.6,
  takeProfitPercentage: 1.5,
  maxDailyLoss: 500,
  riskPerTrade: 0.02,
  minProbability: 0.46,
  minConfidence: 0.25,
  useKellyCriterion: true,
  adaptiveEntryThreshold: true,
  atrBasedTrailingStop: true,
  initialBalance: 10000
};

const DEFAULT_PORTFOLIO: Portfolio = {
  baseCapital: 10000,
  availableBalance: 10000,
  lockedProfits: 0,
  positions: [],
  totalPnL: 0,
  dayPnL: 0,
  equity: 10000
};

const DEFAULT_MODEL_PERFORMANCE: ModelPerformance = {
  totalTrades: 0,
  winRate: 0,
  sharpeRatio: 0,
  maxDrawdown: 0,
  profitFactor: 0,
  avgWin: 0,
  avgLoss: 0
};

export const useTradingStore = create<TradingState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    priceData: null,
    isPriceStale: false,
    orderBook: { bids: [], asks: [], lastUpdateId: 0 },
    portfolio: DEFAULT_PORTFOLIO,
    config: DEFAULT_CONFIG,
    webSocket: {
      isConnected: false,
      apiHealthy: null,
      latestUpdate: null,
      connectionStable: false,
      updateCount: 0
    },
    signals: [],
    modelPerformance: DEFAULT_MODEL_PERFORMANCE,

    // Actions
    updatePriceData: (priceData: PriceData) => {
      set({ priceData, isPriceStale: false });
      console.log('🏪 Store: Price data updated', priceData);
    },

    setPriceStale: (isStale: boolean) => {
      set({ isPriceStale: isStale });
      if (isStale) {
        console.log('⚠️ Store: Price data marked as stale');
      }
    },

    updateOrderBook: (orderBook: OrderBook) => {
      set({ orderBook });
      
      // Auto-update price data from order book
      if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
        const bid = orderBook.bids[0].price;
        const ask = orderBook.asks[0].price;
        const mid = (bid + ask) / 2;
        const spread = ask - bid;
        
        const priceData: PriceData = {
          bid,
          ask,
          mid,
          spread,
          timestamp: Date.now(),
          symbol: 'BTCUSDT'
        };
        
        get().updatePriceData(priceData);
      }
    },

    updatePortfolio: (portfolio: Portfolio) => {
      set({ portfolio });
      console.log('🏪 Store: Portfolio updated', portfolio);
    },

    updateConfiguration: (updates: Partial<TradingConfiguration>) => {
      const currentConfig = get().config || DEFAULT_CONFIG;
      const newConfig = { ...currentConfig, ...updates };
      set({ config: newConfig });
      console.log('🏪 Store: Configuration updated', newConfig);
    },

    setConfiguration: (config: TradingConfiguration) => {
      set({ config });
      console.log('🏪 Store: Configuration set', config);
    },

    updateWebSocketState: (state: Partial<WebSocketState>) => {
      set((prev) => ({
        webSocket: { ...prev.webSocket, ...state }
      }));
    },

    addSignal: (signal: TradingSignal) => {
      set((state) => ({
        signals: [...state.signals.slice(-99), signal] // Keep last 100 signals
      }));
      console.log('🏪 Store: Signal added', signal);
    },

    clearSignals: () => {
      set({ signals: [] });
      console.log('🏪 Store: Signals cleared');
    },

    updateModelPerformance: (performance: Partial<ModelPerformance>) => {
      set((state) => ({
        modelPerformance: { ...state.modelPerformance, ...performance }
      }));
      console.log('🏪 Store: Model performance updated', performance);
    },

    // Computed values
    getCurrentPrice: () => {
      const { priceData } = get();
      return priceData?.mid || 0;
    },

    getBidAskSpread: () => {
      const { priceData } = get();
      return priceData?.spread || 0;
    },

    getEquityChange: () => {
      const { portfolio } = get();
      return portfolio.baseCapital > 0 
        ? ((portfolio.equity - portfolio.baseCapital) / portfolio.baseCapital) * 100 
        : 0;
    },

    getOpenPositions: () => {
      const { portfolio } = get();
      return portfolio.positions.filter(p => p.status === 'OPEN');
    },

    getTotalUnrealizedPnL: () => {
      const openPositions = get().getOpenPositions();
      return openPositions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
    }
  }))
);

// Selectors for better performance
export const selectPriceData = (state: TradingState) => state.priceData;
export const selectCurrentPrice = (state: TradingState) => state.getCurrentPrice();
export const selectPortfolio = (state: TradingState) => state.portfolio;
export const selectConfiguration = (state: TradingState) => state.config;
export const selectWebSocketState = (state: TradingState) => state.webSocket;
export const selectSignals = (state: TradingState) => state.signals;
export const selectModelPerformance = (state: TradingState) => state.modelPerformance;
