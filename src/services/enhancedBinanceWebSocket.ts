
interface DepthData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

interface BinanceDepthEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  U: number; // First update ID in event
  u: number; // Final update ID in event
  b: [string, string][]; // Bids to be updated
  a: [string, string][]; // Asks to be updated
}

interface BinanceTradeEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  t: number; // Trade ID
  p: string; // Price
  q: string; // Quantity
  b: number; // Buyer order ID
  a: number; // Seller order ID
  T: number; // Trade time
  m: boolean; // Is the buyer the market maker?
  M: boolean; // Ignore
}

interface BinanceTickerEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  p: string; // Price change
  P: string; // Price change percent
  w: string; // Weighted avg price
  x: string; // First trade before 24hr rolling window
  c: string; // Last price
  Q: string; // Last quantity
  b: string; // Best bid price
  B: string; // Best bid qty
  a: string; // Best ask price
  A: string; // Best ask qty
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  q: string; // Quote asset volume
  O: number; // Open time
  C: number; // Close time
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Trade count
}

type BinanceWebSocketEvent = BinanceDepthEvent | BinanceTradeEvent | BinanceTickerEvent;

interface WebSocketConfig {
  maxReconnectAttempts: number;
  reconnectDelayMs: number;
  messageThrottleMs: number;
  staleConnectionTimeoutMs: number;
  heartbeatIntervalMs: number;
  bufferSize: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  maxReconnectAttempts: 10,
  reconnectDelayMs: 1000,
  messageThrottleMs: 16, // ~60fps
  staleConnectionTimeoutMs: 60000,
  heartbeatIntervalMs: 30000,
  bufferSize: 1000
};

export class EnhancedBinanceWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private config: WebSocketConfig;
  private symbol: string;
  private streams: string[];
  private messageBuffer: BinanceWebSocketEvent[] = [];
  private lastMessageTime = 0;
  private lastProcessedTime = 0;
  private heartbeatTimer: number | null = null;
  private staleConnectionTimer: number | null = null;
  private orderBookSnapshot: DepthData | null = null;
  private pendingUpdates: BinanceDepthEvent[] = [];

  // Event handlers
  private onDepthUpdate: (data: BinanceDepthEvent) => void;
  private onTradeUpdate: (data: BinanceTradeEvent) => void;
  private onTickerUpdate: (data: BinanceTickerEvent) => void;
  private onConnectionStatusChange: (status: boolean) => void;
  private onError: (error: string) => void;

  constructor(
    symbol: string,
    handlers: {
      onDepthUpdate: (data: BinanceDepthEvent) => void;
      onTradeUpdate?: (data: BinanceTradeEvent) => void;
      onTickerUpdate?: (data: BinanceTickerEvent) => void;
      onConnectionStatusChange: (status: boolean) => void;
      onError?: (error: string) => void;
    },
    config: Partial<WebSocketConfig> = {}
  ) {
    this.symbol = symbol.toLowerCase();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streams = [`${this.symbol}@depth`, `${this.symbol}@trade`, `${this.symbol}@ticker`];
    
    this.onDepthUpdate = handlers.onDepthUpdate;
    this.onTradeUpdate = handlers.onTradeUpdate || (() => {});
    this.onTickerUpdate = handlers.onTickerUpdate || (() => {});
    this.onConnectionStatusChange = handlers.onConnectionStatusChange;
    this.onError = handlers.onError || ((error) => console.error('WebSocket Error:', error));
  }

  async connect() {
    try {
      // Clean up existing connection
      this.disconnect();
      
      // Initialize order book snapshot first
      await this.initializeOrderBookSnapshot();
      
      // Connect to combined streams
      const streamList = this.streams.join('/');
      const wsUrl = `wss://stream.binance.us:9443/stream?streams=${streamList}`;
      
      console.log(`🔌 Connecting to Enhanced WebSocket: ${wsUrl}`);
      this.ws = new WebSocket(wsUrl);
      
      this.setupWebSocketHandlers();
      
    } catch (error) {
      this.onError(`Connection failed: ${error}`);
      this.handleReconnect();
    }
  }

  private async initializeOrderBookSnapshot() {
    try {
      console.log(`📸 Fetching order book snapshot for ${this.symbol.toUpperCase()}`);
      
      const response = await fetch(
        `https://api.binance.us/api/v3/depth?symbol=${this.symbol.toUpperCase()}&limit=1000`,
        { cache: 'no-cache' }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot: ${response.status}`);
      }
      
      this.orderBookSnapshot = await response.json();
      console.log(`✅ Order book snapshot initialized with ${this.orderBookSnapshot.bids.length} bids and ${this.orderBookSnapshot.asks.length} asks`);
      
    } catch (error) {
      console.error('❌ Failed to initialize order book snapshot:', error);
      throw error;
    }
  }

  private setupWebSocketHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log(`✅ Enhanced WebSocket connected for ${this.symbol.toUpperCase()}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastMessageTime = Date.now();
      this.onConnectionStatusChange(true);
      
      this.startHeartbeat();
      this.startStaleConnectionMonitor();
      this.processPendingUpdates();
    };

    this.ws.onmessage = (event) => {
      this.lastMessageTime = Date.now();
      
      try {
        const message = JSON.parse(event.data);
        
        // Handle combined stream format
        if (message.stream && message.data) {
          this.handleStreamMessage(message.stream, message.data);
        } else {
          // Handle single stream format
          this.handleStreamMessage('', message);
        }
        
      } catch (error) {
        this.onError(`Message parsing error: ${error}`);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`🔌 Enhanced WebSocket closed: ${event.code} - ${event.reason}`);
      this.isConnected = false;
      this.onConnectionStatusChange(false);
      this.stopHeartbeat();
      this.stopStaleConnectionMonitor();
      
      // Only reconnect if it wasn't a manual disconnection
      if (event.code !== 1000) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ Enhanced WebSocket error:', error);
      this.onError('WebSocket connection error');
    };
  }

  private handleStreamMessage(stream: string, data: BinanceWebSocketEvent) {
    const now = Date.now();
    
    // Throttle message processing
    if (now - this.lastProcessedTime < this.config.messageThrottleMs) {
      this.messageBuffer.push(data);
      return;
    }
    
    this.lastProcessedTime = now;
    
    // Process the current message
    this.processMessage(data);
    
    // Process buffered messages (take latest)
    if (this.messageBuffer.length > 0) {
      const latestBuffered = this.messageBuffer[this.messageBuffer.length - 1];
      this.processMessage(latestBuffered);
      this.messageBuffer = [];
    }
  }

  private processMessage(data: BinanceWebSocketEvent) {
    switch (data.e) {
      case 'depthUpdate':
        this.handleDepthUpdate(data as BinanceDepthEvent);
        break;
      case 'trade':
        this.onTradeUpdate(data as BinanceTradeEvent);
        break;
      case '24hrTicker':
        this.onTickerUpdate(data as BinanceTickerEvent);
        break;
      default:
        console.log('🔄 Unknown event type:', data.e);
    }
  }

  private handleDepthUpdate(data: BinanceDepthEvent) {
    // Ensure we have a snapshot and the update is valid
    if (!this.orderBookSnapshot) {
      this.pendingUpdates.push(data);
      return;
    }
    
    // Check if update is in sequence
    if (data.U <= this.orderBookSnapshot.lastUpdateId || data.u <= this.orderBookSnapshot.lastUpdateId) {
      // Skip outdated updates
      return;
    }
    
    // Apply the update
    this.onDepthUpdate(data);
  }

  private processPendingUpdates() {
    if (!this.orderBookSnapshot || this.pendingUpdates.length === 0) return;
    
    // Process pending updates that are now valid
    const validUpdates = this.pendingUpdates.filter(
      update => update.U > this.orderBookSnapshot!.lastUpdateId
    );
    
    validUpdates.forEach(update => this.onDepthUpdate(update));
    this.pendingUpdates = [];
    
    console.log(`✅ Processed ${validUpdates.length} pending depth updates`);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Binance doesn't require ping, but we can log health
        console.log('💓 WebSocket heartbeat - connection healthy');
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startStaleConnectionMonitor() {
    this.stopStaleConnectionMonitor();
    this.staleConnectionTimer = window.setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (timeSinceLastMessage > this.config.staleConnectionTimeoutMs) {
        console.warn('⚠️ Stale connection detected - reconnecting');
        this.handleReconnect();
      }
    }, this.config.staleConnectionTimeoutMs / 2);
  }

  private stopStaleConnectionMonitor() {
    if (this.staleConnectionTimer) {
      clearInterval(this.staleConnectionTimer);
      this.staleConnectionTimer = null;
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.onError(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${Math.round(delay + jitter)}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay + jitter);
  }

  disconnect() {
    console.log('🛑 Disconnecting Enhanced WebSocket...');
    
    this.stopHeartbeat();
    this.stopStaleConnectionMonitor();
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageBuffer = [];
    this.pendingUpdates = [];
    this.onConnectionStatusChange(false);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      bufferSize: this.messageBuffer.length,
      pendingUpdates: this.pendingUpdates.length,
      lastMessageTime: this.lastMessageTime,
      hasSnapshot: !!this.orderBookSnapshot
    };
  }

  // Force cleanup method for memory management
  cleanup() {
    this.disconnect();
    this.messageBuffer = [];
    this.pendingUpdates = [];
    this.orderBookSnapshot = null;
  }
}

// Enhanced API health check with timeout and retry logic
export const checkEnhancedBinanceAPIHealth = async (retries = 3): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('https://api.binance.us/api/v3/ping', {
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`✅ API health check passed (attempt ${attempt})`);
        return true;
      }
      
    } catch (error) {
      console.warn(`⚠️ API health check failed (attempt ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  console.error('❌ API health check failed after all retries');
  return false;
};
