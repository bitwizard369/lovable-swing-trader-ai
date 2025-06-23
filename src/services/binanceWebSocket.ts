
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

export class BinanceWebSocketService {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private symbol: string;
  private onDepthUpdate: (data: BinanceDepthEvent) => void;
  private onConnectionStatusChange: (status: boolean) => void;
  private messageBuffer: BinanceDepthEvent[] = [];
  private lastProcessedTime = 0;
  private readonly MESSAGE_THROTTLE_MS = 50; // Throttle to prevent spam

  constructor(
    symbol: string,
    onDepthUpdate: (data: BinanceDepthEvent) => void,
    onConnectionStatusChange: (status: boolean) => void
  ) {
    this.symbol = symbol.toLowerCase();
    this.onDepthUpdate = onDepthUpdate;
    this.onConnectionStatusChange = onConnectionStatusChange;
  }

  connect() {
    // Clean up existing connection first
    this.disconnect();
    
    const wsUrl = `wss://stream.binance.us:9443/ws/${this.symbol}@depth`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log(`✅ Connected to Binance.US WebSocket for ${this.symbol.toUpperCase()}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionStatusChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: BinanceDepthEvent = JSON.parse(event.data);
          this.throttledUpdateHandler(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔌 WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.onConnectionStatusChange(false);
        
        // Only reconnect if it wasn't a manual disconnection
        if (event.code !== 1000) {
          this.handleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.onConnectionStatusChange(false);
      };
    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      this.onConnectionStatusChange(false);
    }
  }

  private throttledUpdateHandler(data: BinanceDepthEvent) {
    const now = Date.now();
    
    // Throttle rapid updates to prevent browser overload
    if (now - this.lastProcessedTime < this.MESSAGE_THROTTLE_MS) {
      this.messageBuffer.push(data);
      return;
    }
    
    // Process the latest update
    this.lastProcessedTime = now;
    this.onDepthUpdate(data);
    
    // Clear buffer after processing
    this.messageBuffer = [];
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect'); // Use proper close code
      this.ws = null;
    }
    this.isConnected = false;
    this.messageBuffer = []; // Clear buffer
    this.onConnectionStatusChange(false);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Force cleanup method for memory management
  cleanup() {
    this.disconnect();
    this.messageBuffer = [];
  }
}

// API health check with better error handling
export const checkBinanceAPIHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch('https://api.binance.us/api/v3/ping', {
      signal: controller.signal,
      cache: 'no-cache' // Prevent browser caching
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('❌ Binance API health check failed:', error);
    return false;
  }
};
