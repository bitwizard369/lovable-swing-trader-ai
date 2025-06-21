
import { Portfolio, Position } from '@/types/trading';

export interface PortfolioDiscrepancy {
  type: 'calculation' | 'data' | 'rounding';
  field: string;
  expected: number;
  actual: number;
  difference: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ReconciliationReport {
  isConsistent: boolean;
  discrepancies: PortfolioDiscrepancy[];
  calculatedValues: {
    expectedEquity: number;
    expectedTotalPnL: number;
    expectedUnrealizedPnL: number;
    expectedRealizedPnL: number;
  };
  metadata: {
    timestamp: number;
    openPositionsCount: number;
    closedPositionsCount: number;
  };
}

export class PortfolioReconciliationService {
  private static readonly TOLERANCE = 0.01; // $0.01 tolerance for floating point errors

  static reconcilePortfolio(portfolio: Portfolio): ReconciliationReport {
    console.log(`[Portfolio Reconciliation] 🔍 Starting reconciliation for portfolio with ${portfolio.positions.length} positions`);
    
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    const closedPositions = portfolio.positions.filter(p => p.status === 'CLOSED');
    
    // Calculate expected values
    const expectedUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const expectedRealizedPnL = closedPositions.reduce((sum, p) => sum + p.realizedPnL, 0);
    const expectedTotalPnL = expectedRealizedPnL + expectedUnrealizedPnL;
    const expectedEquity = portfolio.baseCapital + expectedTotalPnL + portfolio.lockedProfits;
    
    console.log(`[Portfolio Reconciliation] 📊 Expected calculations:`);
    console.log(`  - Base Capital: ${portfolio.baseCapital.toFixed(2)}`);
    console.log(`  - Expected Unrealized P&L: ${expectedUnrealizedPnL.toFixed(2)} (from ${openPositions.length} open positions)`);
    console.log(`  - Expected Realized P&L: ${expectedRealizedPnL.toFixed(2)} (from ${closedPositions.length} closed positions)`);
    console.log(`  - Expected Total P&L: ${expectedTotalPnL.toFixed(2)}`);
    console.log(`  - Locked Profits: ${portfolio.lockedProfits.toFixed(2)}`);
    console.log(`  - Expected Equity: ${expectedEquity.toFixed(2)}`);
    
    console.log(`[Portfolio Reconciliation] 📋 Actual values:`);
    console.log(`  - Actual Total P&L: ${portfolio.totalPnL.toFixed(2)}`);
    console.log(`  - Actual Equity: ${portfolio.equity.toFixed(2)}`);
    console.log(`  - Available Balance: ${portfolio.availableBalance.toFixed(2)}`);
    console.log(`  - Day P&L: ${portfolio.dayPnL.toFixed(2)}`);

    const discrepancies: PortfolioDiscrepancy[] = [];

    // Check equity calculation
    const equityDifference = Math.abs(portfolio.equity - expectedEquity);
    if (equityDifference > this.TOLERANCE) {
      discrepancies.push({
        type: 'calculation',
        field: 'equity',
        expected: expectedEquity,
        actual: portfolio.equity,
        difference: equityDifference,
        severity: equityDifference > 10 ? 'high' : equityDifference > 1 ? 'medium' : 'low',
        description: `Equity calculation mismatch: Expected ${expectedEquity.toFixed(2)}, Got ${portfolio.equity.toFixed(2)}`
      });
    }

    // Check total P&L calculation
    const totalPnLDifference = Math.abs(portfolio.totalPnL - expectedTotalPnL);
    if (totalPnLDifference > this.TOLERANCE) {
      discrepancies.push({
        type: 'calculation',
        field: 'totalPnL',
        expected: expectedTotalPnL,
        actual: portfolio.totalPnL,
        difference: totalPnLDifference,
        severity: totalPnLDifference > 10 ? 'high' : totalPnLDifference > 1 ? 'medium' : 'low',
        description: `Total P&L calculation mismatch: Expected ${expectedTotalPnL.toFixed(2)}, Got ${portfolio.totalPnL.toFixed(2)}`
      });
    }

    // Validate individual position calculations
    openPositions.forEach((position, index) => {
      if (position.currentPrice <= 0) {
        discrepancies.push({
          type: 'data',
          field: `position[${index}].currentPrice`,
          expected: position.entryPrice,
          actual: position.currentPrice,
          difference: Math.abs(position.currentPrice - position.entryPrice),
          severity: 'high',
          description: `Invalid current price for position ${position.id}: ${position.currentPrice}`
        });
      }

      // Recalculate unrealized P&L for validation
      const expectedPositionPnL = position.side === 'BUY'
        ? (position.currentPrice - position.entryPrice) * position.size
        : (position.entryPrice - position.currentPrice) * position.size;
      
      const positionPnLDifference = Math.abs(position.unrealizedPnL - expectedPositionPnL);
      if (positionPnLDifference > this.TOLERANCE) {
        discrepancies.push({
          type: 'calculation',
          field: `position[${index}].unrealizedPnL`,
          expected: expectedPositionPnL,
          actual: position.unrealizedPnL,
          difference: positionPnLDifference,
          severity: positionPnLDifference > 5 ? 'high' : positionPnLDifference > 1 ? 'medium' : 'low',
          description: `Position ${position.id} P&L mismatch: Expected ${expectedPositionPnL.toFixed(2)}, Got ${position.unrealizedPnL.toFixed(2)}`
        });
      }
    });

    // Check for negative balances (unusual but possible)
    if (portfolio.availableBalance < 0) {
      discrepancies.push({
        type: 'data',
        field: 'availableBalance',
        expected: 0,
        actual: portfolio.availableBalance,
        difference: Math.abs(portfolio.availableBalance),
        severity: 'medium',
        description: `Negative available balance: ${portfolio.availableBalance.toFixed(2)}`
      });
    }

    const isConsistent = discrepancies.length === 0;
    
    console.log(`[Portfolio Reconciliation] ${isConsistent ? '✅' : '❌'} Reconciliation ${isConsistent ? 'passed' : 'failed'} with ${discrepancies.length} discrepancies`);
    
    if (!isConsistent) {
      console.log(`[Portfolio Reconciliation] 🚨 Found discrepancies:`);
      discrepancies.forEach((discrepancy, i) => {
        console.log(`  ${i + 1}. [${discrepancy.severity.toUpperCase()}] ${discrepancy.description}`);
      });
    }

    return {
      isConsistent,
      discrepancies,
      calculatedValues: {
        expectedEquity,
        expectedTotalPnL,
        expectedUnrealizedPnL,
        expectedRealizedPnL
      },
      metadata: {
        timestamp: Date.now(),
        openPositionsCount: openPositions.length,
        closedPositionsCount: closedPositions.length
      }
    };
  }

  static createCorrectedPortfolio(portfolio: Portfolio, report: ReconciliationReport): Portfolio {
    console.log(`[Portfolio Reconciliation] 🔧 Creating corrected portfolio based on reconciliation`);
    
    const correctedPortfolio: Portfolio = {
      ...portfolio,
      totalPnL: report.calculatedValues.expectedTotalPnL,
      equity: report.calculatedValues.expectedEquity
    };

    // Fix any position calculation errors
    const correctedPositions = portfolio.positions.map(position => {
      if (position.status === 'OPEN') {
        const expectedPnL = position.side === 'BUY'
          ? (position.currentPrice - position.entryPrice) * position.size
          : (position.entryPrice - position.currentPrice) * position.size;
        
        return {
          ...position,
          unrealizedPnL: expectedPnL
        };
      }
      return position;
    });

    correctedPortfolio.positions = correctedPositions;
    
    console.log(`[Portfolio Reconciliation] ✅ Portfolio corrected: Equity ${portfolio.equity.toFixed(2)} → ${correctedPortfolio.equity.toFixed(2)}`);
    
    return correctedPortfolio;
  }
}
