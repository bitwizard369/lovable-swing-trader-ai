
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
    const wsUrl = `wss://stream.binance.us:9443/ws/${this.symbol}@depth`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log(`Connected to Binance.US WebSocket for ${this.symbol.toUpperCase()}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnectionStatusChange(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data: BinanceDepthEvent = JSON.parse(event.data);
          this.onDepthUpdate(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnected = false;
        this.onConnectionStatusChange(false);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
        this.onConnectionStatusChange(false);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.onConnectionStatusChange(false);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.onConnectionStatusChange(false);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// API health check
export const checkBinanceAPIHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch('https://api.binance.us/api/v3/ping');
    return response.ok;
  } catch (error) {
    console.error('Binance API health check failed:', error);
    return false;
  }
};
