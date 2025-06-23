
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
    // Initialize with ONLY the $10K demo balance - NO FALLBACK DATA
    this.accountData = this.initializeDemoAccount();
    
    console.log('📊 Real Portfolio Service initialized with DEMO MODE ONLY');
    console.log('💰 Starting balance: $10,000 (Paper money for real market data testing)');
    console.log('🚨 NO synthetic or fallback data will be used');
  }

  static getInstance(): RealPortfolioService {
    if (!RealPortfolioService.instance) {
      RealPortfolioService.instance = new RealPortfolioService();
    }
    return RealPortfolioService.instance;
  }

  private initializeDemoAccount(): RealAccountData {
    // ONLY use the demo $10K balance - no detection of "real" account data
    // This is paper money for testing with real market data
    const demoAccount: RealAccountData = {
      accountBalance: 10000, // Demo paper money
      availableBalance: 10000,
      lockedBalance: 0,
      positions: [],
      lastUpdated: Date.now()
    };

    console.log('💡 Demo account initialized: $10,000 paper money for real market data testing');
    return demoAccount;
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
    
    // Real balance validation with demo money
    if (this.accountData.availableBalance < positionValue) {
      console.error('❌ Insufficient demo balance for position');
      return null;
    }

    const newPosition: Position = {
      ...position,
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      unrealizedPnL: 0,
      realizedPnL: 0,
      status: 'OPEN'
    };

    // Update demo account balances
    this.accountData.availableBalance -= positionValue;
    this.accountData.positions.push(newPosition);
    this.accountData.lastUpdated = Date.now();

    console.log(`✅ Demo position added: ${newPosition.side} ${newPosition.size} at ${newPosition.entryPrice} (Paper money)`);
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

    // Update demo account balance with realized P&L
    this.accountData.accountBalance += realizedPnL;
    this.accountData.availableBalance += realizedPnL;
    this.accountData.lastUpdated = Date.now();
    
    console.log(`✅ Demo position closed: P&L ${realizedPnL.toFixed(6)} (Paper money)`);
    this.notifySubscribers();
    
    return true;
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

  public isUsingRealData(): boolean {
    // Always return false since this is demo money, not real broker data
    return false;
  }

  public getAccountInfo(): RealAccountData {
    return { ...this.accountData };
  }
}
