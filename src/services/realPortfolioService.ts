import { Portfolio, Position } from '@/types/trading';
import { MeanReversionTPSLService, MeanReversionLevels } from './meanReversionTPSLService';
import { AdvancedIndicators, MarketContext } from './advancedTechnicalAnalysis';

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
  private positionTimers: Map<string, NodeJS.Timeout> = new Map();
  private meanReversionService: MeanReversionTPSLService;
  private positionMeanReversionLevels: Map<string, MeanReversionLevels> = new Map();

  private constructor() {
    // Initialize with ONLY the $10K demo balance - NO FALLBACK DATA
    this.accountData = this.initializeDemoAccount();
    this.meanReversionService = new MeanReversionTPSLService();
    
    console.log('📊 Real Portfolio Service initialized with DEMO MODE ONLY');
    console.log('💰 Starting balance: $10,000 (Paper money for real market data testing)');
    console.log('🎯 Mean Reversion TP/SL system active');
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

  public addPosition(
    position: Omit<Position, 'id' | 'unrealizedPnL' | 'realizedPnL' | 'status' | 'maxHoldTime'>,
    indicators?: AdvancedIndicators,
    marketContext?: MarketContext
  ): Position | null {
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
      status: 'OPEN',
      maxHoldTime: 300 // 5 minutes
    };

    // Update demo account balances
    this.accountData.availableBalance -= positionValue;
    this.accountData.positions.push(newPosition);
    this.accountData.lastUpdated = Date.now();

    // Calculate mean reversion levels if indicators provided
    if (indicators && marketContext) {
      const meanReversionLevels = this.meanReversionService.calculateMeanReversionLevels(
        newPosition,
        indicators,
        marketContext
      );
      this.positionMeanReversionLevels.set(newPosition.id, meanReversionLevels);
      
      // Store dynamic levels in position
      newPosition.dynamicProfitTarget = meanReversionLevels.takeProfitPrice;
      newPosition.dynamicStopLoss = meanReversionLevels.stopLossPrice;
      
      console.log(`🎯 Mean reversion levels set: TP=${meanReversionLevels.takeProfitPrice.toFixed(2)}, SL=${meanReversionLevels.stopLossPrice.toFixed(2)}`);
    }

    // Set up auto-close timer for 300 seconds (fallback)
    this.setupPositionTimer(newPosition);

    console.log(`✅ Demo position added: ${newPosition.side} ${newPosition.size} at ${newPosition.entryPrice}`);
    this.notifySubscribers();
    
    return newPosition;
  }

  private setupPositionTimer(position: Position): void {
    const timer = setTimeout(() => {
      this.closePositionByTimeLimit(position.id);
    }, 300000); // 300 seconds = 5 minutes

    this.positionTimers.set(position.id, timer);
    console.log(`⏱️ Timer set for position ${position.id}: 300 seconds`);
  }

  private closePositionByTimeLimit(positionId: string): void {
    const position = this.accountData.positions.find(p => p.id === positionId);
    if (position && position.status === 'OPEN') {
      console.log(`⏰ Position ${positionId} reached time limit, auto-closing`);
      this.closePosition(positionId, position.currentPrice, 'TIME_LIMIT');
    }
  }

  public closePosition(positionId: string, closePrice: number, exitReason: Position['exitReason'] = 'MANUAL'): boolean {
    const positionIndex = this.accountData.positions.findIndex(p => p.id === positionId);
    
    if (positionIndex === -1) {
      console.error('❌ Position not found for closing:', positionId);
      return false;
    }

    const position = this.accountData.positions[positionIndex];
    const realizedPnL = position.side === 'BUY'
      ? (closePrice - position.entryPrice) * position.size
      : (position.entryPrice - closePrice) * position.size;

    // Clear the position timer
    const timer = this.positionTimers.get(positionId);
    if (timer) {
      clearTimeout(timer);
      this.positionTimers.delete(positionId);
    }

    // Update position
    position.status = 'CLOSED';
    position.realizedPnL = realizedPnL;
    position.currentPrice = closePrice;
    position.exitReason = exitReason;
    position.exitTime = Date.now();

    // Update demo account balance with realized P&L
    this.accountData.accountBalance += realizedPnL;
    this.accountData.availableBalance += realizedPnL;
    this.accountData.lastUpdated = Date.now();

    // Log exit effectiveness for learning
    const holdTime = (Date.now() - position.timestamp) / 1000;
    // Note: marketContext would need to be passed in for full logging
    
    // Clean up mean reversion levels
    this.positionMeanReversionLevels.delete(positionId);
    
    console.log(`✅ Demo position closed: P&L ${realizedPnL.toFixed(6)} (${exitReason})`);
    this.notifySubscribers();
    
    return true;
  }

  public updatePositionPrice(positionId: string, currentPrice: number, indicators?: AdvancedIndicators, marketContext?: MarketContext): void {
    const position = this.accountData.positions.find(p => p.id === positionId && p.status === 'OPEN');
    if (!position) return;

    const previousPrice = position.currentPrice;
    position.currentPrice = currentPrice;
    
    // Calculate unrealized P&L
    position.unrealizedPnL = position.side === 'BUY'
      ? (currentPrice - position.entryPrice) * position.size
      : (position.entryPrice - currentPrice) * position.size;

    // Update price data for mean reversion service
    this.meanReversionService.updatePriceData(currentPrice);

    // Check for mean reversion exit conditions
    if (indicators && marketContext) {
      this.checkMeanReversionExitConditions(position, indicators, marketContext);
    } else {
      // Fallback to simple dynamic exit if no indicators
      this.checkDynamicExitConditions(position);
    }

    // Only notify if price changed significantly to avoid excessive updates
    if (Math.abs(currentPrice - previousPrice) > previousPrice * 0.001) { // 0.1% change
      this.notifySubscribers();
    }
  }

  private checkMeanReversionExitConditions(position: Position, indicators: AdvancedIndicators, marketContext: MarketContext): void {
    const meanReversionLevels = this.positionMeanReversionLevels.get(position.id);
    if (!meanReversionLevels) return;

    const currentPrice = position.currentPrice;
    
    // Check for take profit
    if (position.side === 'BUY' && currentPrice >= meanReversionLevels.takeProfitPrice) {
      console.log(`🎯 Mean reversion take profit hit for ${position.id}: ${currentPrice.toFixed(2)} >= ${meanReversionLevels.takeProfitPrice.toFixed(2)}`);
      this.closePosition(position.id, currentPrice, 'TAKE_PROFIT');
      return;
    }
    
    if (position.side === 'SELL' && currentPrice <= meanReversionLevels.takeProfitPrice) {
      console.log(`🎯 Mean reversion take profit hit for ${position.id}: ${currentPrice.toFixed(2)} <= ${meanReversionLevels.takeProfitPrice.toFixed(2)}`);
      this.closePosition(position.id, currentPrice, 'TAKE_PROFIT');
      return;
    }

    // Check for stop loss
    if (position.side === 'BUY' && currentPrice <= meanReversionLevels.stopLossPrice) {
      console.log(`🛡️ Mean reversion stop loss hit for ${position.id}: ${currentPrice.toFixed(2)} <= ${meanReversionLevels.stopLossPrice.toFixed(2)}`);
      this.closePosition(position.id, currentPrice, 'STOP_LOSS');
      return;
    }
    
    if (position.side === 'SELL' && currentPrice >= meanReversionLevels.stopLossPrice) {
      console.log(`🛡️ Mean reversion stop loss hit for ${position.id}: ${currentPrice.toFixed(2)} >= ${meanReversionLevels.stopLossPrice.toFixed(2)}`);
      this.closePosition(position.id, currentPrice, 'STOP_LOSS');
      return;
    }

    // Update trailing stop if applicable
    if (meanReversionLevels.trailingStopPrice) {
      const newTrailingStop = this.calculateNewTrailingStop(position, indicators, marketContext);
      if (newTrailingStop !== meanReversionLevels.trailingStopPrice) {
        meanReversionLevels.trailingStopPrice = newTrailingStop;
        console.log(`📈 Updated trailing stop for ${position.id}: ${newTrailingStop.toFixed(2)}`);
      }
    }
  }

  private calculateNewTrailingStop(position: Position, indicators: AdvancedIndicators, marketContext: MarketContext): number {
    const atr = indicators.atr || (position.currentPrice * 0.01);
    const volatilityMultiplier = marketContext.volatilityRegime === 'HIGH' ? 2.5 :
                                marketContext.volatilityRegime === 'MEDIUM' ? 1.8 : 1.2;

    const trailingDistance = atr * volatilityMultiplier;

    if (position.side === 'BUY') {
      return position.currentPrice - trailingDistance;
    } else {
      return position.currentPrice + trailingDistance;
    }
  }

  private checkDynamicExitConditions(position: Position): void {
    const elapsedTime = (Date.now() - position.timestamp) / 1000;
    const timeDecayFactor = 1 - (elapsedTime / 300); // 300 seconds
    
    // Dynamic profit target (starts at 1.5%, adjusts with time)
    const baseProfitTarget = 0.015;
    const adjustedProfitTarget = baseProfitTarget * (0.7 + timeDecayFactor * 0.6);
    
    // Dynamic stop loss (starts at 0.8%, tightens over time)
    const baseStopLoss = 0.008;
    const adjustedStopLoss = baseStopLoss * (1.2 - timeDecayFactor * 0.4);
    
    const priceChange = position.side === 'BUY' 
      ? (position.currentPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - position.currentPrice) / position.entryPrice;
    
    // Check for take profit
    if (priceChange >= adjustedProfitTarget) {
      console.log(`🎯 Dynamic take profit hit for ${position.id}: ${(priceChange * 100).toFixed(2)}%`);
      this.closePosition(position.id, position.currentPrice, 'DYNAMIC_EXIT');
      return;
    }
    
    // Check for stop loss
    if (priceChange <= -adjustedStopLoss) {
      console.log(`🛡️ Dynamic stop loss hit for ${position.id}: ${(priceChange * 100).toFixed(2)}%`);
      this.closePosition(position.id, position.currentPrice, 'DYNAMIC_EXIT');
      return;
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

  public isUsingRealData(): boolean {
    // Always return false since this is demo money, not real broker data
    return false;
  }

  public getAccountInfo(): RealAccountData {
    return { ...this.accountData };
  }

  public getMeanReversionService(): MeanReversionTPSLService {
    return this.meanReversionService;
  }

  // Cleanup method to clear all timers
  public cleanup(): void {
    this.positionTimers.forEach(timer => clearTimeout(timer));
    this.positionTimers.clear();
    this.positionMeanReversionLevels.clear();
  }
}
