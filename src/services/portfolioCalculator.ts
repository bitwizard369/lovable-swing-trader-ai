
import { Portfolio, Position } from '@/types/trading';

export class PortfolioCalculator {
  // Use 6 decimal places for financial precision
  private static readonly PRECISION = 6;

  /**
   * Round to financial precision (6 decimal places)
   */
  private static round(value: number): number {
    return Math.round(value * Math.pow(10, this.PRECISION)) / Math.pow(10, this.PRECISION);
  }

  /**
   * Calculate position P&L with precise arithmetic
   */
  static calculatePositionPnL(position: Position): number {
    if (position.status === 'CLOSED') {
      return this.round(position.realizedPnL);
    }

    const priceChange = position.currentPrice - position.entryPrice;
    const unrealizedPnL = position.side === 'BUY' 
      ? priceChange * position.size
      : -priceChange * position.size;
    
    return this.round(unrealizedPnL);
  }

  /**
   * Calculate total unrealized P&L from open positions
   */
  static calculateTotalUnrealizedPnL(positions: Position[]): number {
    const openPositions = positions.filter(p => p.status === 'OPEN');
    const total = openPositions.reduce((sum, position) => {
      return sum + this.calculatePositionPnL(position);
    }, 0);
    
    return this.round(total);
  }

  /**
   * Calculate total realized P&L from closed positions
   */
  static calculateTotalRealizedPnL(positions: Position[]): number {
    const closedPositions = positions.filter(p => p.status === 'CLOSED');
    const total = closedPositions.reduce((sum, position) => {
      return sum + position.realizedPnL;
    }, 0);
    
    return this.round(total);
  }

  /**
   * Calculate total P&L (realized + unrealized)
   */
  static calculateTotalPnL(positions: Position[]): number {
    const realizedPnL = this.calculateTotalRealizedPnL(positions);
    const unrealizedPnL = this.calculateTotalUnrealizedPnL(positions);
    return this.round(realizedPnL + unrealizedPnL);
  }

  /**
   * Calculate portfolio equity with precise arithmetic
   */
  static calculateEquity(baseCapital: number, totalPnL: number, lockedProfits: number): number {
    return this.round(baseCapital + totalPnL + lockedProfits);
  }

  /**
   * Calculate available balance
   */
  static calculateAvailableBalance(
    equity: number, 
    lockedProfits: number, 
    openPositions: Position[]
  ): number {
    const marginUsed = openPositions.reduce((sum, position) => {
      return sum + Math.abs(position.size * position.currentPrice);
    }, 0);
    
    return this.round(equity - lockedProfits - marginUsed);
  }

  /**
   * Recalculate entire portfolio with consistent math
   */
  static recalculatePortfolio(portfolio: Portfolio): Portfolio {
    console.log(`[Portfolio Calculator] 🧮 Recalculating portfolio with ${portfolio.positions.length} positions`);

    // Update position P&L values to ensure consistency
    const updatedPositions = portfolio.positions.map(position => ({
      ...position,
      unrealizedPnL: position.status === 'OPEN' ? this.calculatePositionPnL(position) : 0
    }));

    // Calculate totals with precise arithmetic
    const totalRealizedPnL = this.calculateTotalRealizedPnL(updatedPositions);
    const totalUnrealizedPnL = this.calculateTotalUnrealizedPnL(updatedPositions);
    const totalPnL = this.round(totalRealizedPnL + totalUnrealizedPnL);
    
    // Calculate equity precisely
    const equity = this.calculateEquity(portfolio.baseCapital, totalPnL, portfolio.lockedProfits);
    
    // Calculate available balance
    const openPositions = updatedPositions.filter(p => p.status === 'OPEN');
    const availableBalance = this.calculateAvailableBalance(equity, portfolio.lockedProfits, openPositions);

    const recalculatedPortfolio = {
      ...portfolio,
      positions: updatedPositions,
      totalPnL,
      equity,
      availableBalance
    };

    console.log(`[Portfolio Calculator] ✅ Portfolio recalculated - Equity: ${equity.toFixed(6)}, Total P&L: ${totalPnL.toFixed(6)}`);
    
    return recalculatedPortfolio;
  }
}
