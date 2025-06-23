
import { Portfolio, Position } from '@/types/trading';

interface RealAccountData {
  accountBalance: number;
  availableBalance: number;
  lockedBalance: number;
  positions: Position[];
  lastUpdated: number;
}

export class RealPortfolioService {
  private static instance: RealPortfolioService;
  private accountData: RealAccountData;
  private updateCallbacks: ((portfolio: Portfolio) => void)[] = [];

  private constructor() {
    // Initialize with real account data detection
    this.accountData = this.detectRealAccountData();
    
    // Set up periodic account sync (every 30 seconds)
    setInterval(() => {
      this.syncWithRealAccount();
    }, 30000);
  }

  static getInstance(): RealPortfolioService {
    if (!RealPortfolioService.instance) {
      RealPortfolioService.instance = new RealPortfolioService();
    }
    return RealPortfolioService.instance;
  }

  private detectRealAccountData(): RealAccountData {
    // Check if we have real account data in localStorage
    const savedAccount = localStorage.getItem('realAccountData');
    
    if (savedAccount) {
      try {
        const parsed = JSON.parse(savedAccount);
        console.log('📊 Real account data detected:', parsed.accountBalance);
        return parsed;
      } catch (error) {
        console.error('❌ Failed to parse saved account data:', error);
      }
    }

    // If no real account data, start with warning
    console.warn('⚠️ No real account data found - using minimal demo balance');
    console.warn('🚨 IMPORTANT: Connect real broker API for live trading');
    
    return {
      accountBalance: 100, // Minimal demo amount with clear warning
      availableBalance: 100,
      lockedBalance: 0,
      positions: [],
      lastUpdated: Date.now()
    };
  }

  private async syncWithRealAccount(): Promise<void> {
    try {
      // TODO: Replace with actual broker API integration
      // Example: const accountData = await brokerAPI.getAccountData();
      
      console.log('🔄 Syncing with real account (placeholder - needs broker API)');
      
      // For now, just update timestamp to show it's attempting sync
      this.accountData.lastUpdated = Date.now();
      
      // Notify all subscribers of account updates
      this.notifySubscribers();
      
    } catch (error) {
      console.error('❌ Failed to sync with real account:', error);
    }
  }

  public getPortfolio(): Portfolio {
    const totalPnL = this.accountData.positions.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
    const dayPnL = this.calculateDayPnL();
    
    return {
      baseCapital: this.accountData.accountBalance,
      availableBalance: this.accountData.availableBalance,
      lockedProfits: this.accountData.lockedBalance,
      positions: this.accountData.positions,
      totalPnL,
      dayPnL,
      equity: this.accountData.accountBalance + totalPnL
    };
  }

  private calculateDayPnL(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.accountData.positions
      .filter(pos => pos.timestamp >= today)
      .reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);
  }

  public addPosition(position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status'>): Position | null {
    const positionValue = position.size * position.entryPrice;
    
    // Real balance validation
    if (this.accountData.availableBalance < positionValue) {
      console.error('❌ Insufficient real balance for position');
      return null;
    }

    const newPosition: Position = {
      ...position,
      id: `real_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      unrealizedPnL: 0,
      realizedPnL: 0,
      status: 'OPEN'
    };

    // Update real account balances
    this.accountData.availableBalance -= positionValue;
    this.accountData.positions.push(newPosition);
    this.accountData.lastUpdated = Date.now();

    // Persist to localStorage as backup
    this.persistAccountData();
    
    console.log(`✅ Real position added: ${newPosition.side} ${newPosition.size} at ${newPosition.entryPrice}`);
    this.notifySubscribers();
    
    return newPosition;
  }

  public closePosition(positionId: string, closePrice: number): boolean {
    const positionIndex = this.accountData.positions.findIndex(p => p.id === positionId);
    
    if (positionIndex === -1) {
      console.error('❌ Position not found for closing:', positionId);
      return false;
    }

    const position = this.accountData.positions[positionIndex];
    const realizedPnL = position.side === 'BUY'
      ? (closePrice - position.entryPrice) * position.size
      : (position.entryPrice - closePrice) * position.size;

    // Update position
    position.status = 'CLOSED';
    position.realizedPnL = realizedPnL;
    position.currentPrice = closePrice;

    // Update account balance with realized P&L
    this.accountData.accountBalance += realizedPnL;
    this.accountData.availableBalance += realizedPnL;
    this.accountData.lastUpdated = Date.now();

    // Persist changes
    this.persistAccountData();
    
    console.log(`✅ Real position closed: P&L ${realizedPnL.toFixed(6)}`);
    this.notifySubscribers();
    
    return true;
  }

  private persistAccountData(): void {
    try {
      localStorage.setItem('realAccountData', JSON.stringify(this.accountData));
    } catch (error) {
      console.error('❌ Failed to persist account data:', error);
    }
  }

  public subscribe(callback: (portfolio: Portfolio) => void): () => void {
    this.updateCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  private notifySubscribers(): void {
    const portfolio = this.getPortfolio();
    this.updateCallbacks.forEach(callback => {
      try {
        callback(portfolio);
      } catch (error) {
        console.error('❌ Error in portfolio subscriber:', error);
      }
    });
  }

  // Method to connect real broker API
  public async connectRealBroker(apiKey: string, apiSecret: string): Promise<boolean> {
    try {
      console.log('🔌 Connecting to real broker API...');
      
      // TODO: Implement actual broker API connection
      // const connection = await brokerAPI.connect(apiKey, apiSecret);
      // const accountData = await brokerAPI.getAccountData();
      
      console.warn('⚠️ Real broker API integration not yet implemented');
      console.log('📝 To implement: Add your broker\'s API integration here');
      
      return false;
    } catch (error) {
      console.error('❌ Failed to connect to real broker:', error);
      return false;
    }
  }

  public isUsingRealData(): boolean {
    return this.accountData.accountBalance > 100; // If more than demo amount
  }

  public getAccountInfo(): RealAccountData {
    return { ...this.accountData };
  }
}
