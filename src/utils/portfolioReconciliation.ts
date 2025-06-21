
import { Portfolio, Position } from '@/types/trading';

export interface PortfolioDiscrepancy {
  type: 'calculation' | 'data' | 'rounding' | 'critical';
  field: string;
  expected: number;
  actual: number;
  difference: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  potentialImpact: number; // Financial impact in USD
}

export interface ReconciliationReport {
  isConsistent: boolean;
  hasBookingErrors: boolean;
  hasCriticalDiscrepancies: boolean;
  discrepancies: PortfolioDiscrepancy[];
  calculatedValues: {
    expectedEquity: number;
    expectedTotalPnL: number;
    expectedUnrealizedPnL: number;
    expectedRealizedPnL: number;
    expectedAvailableBalance: number;
  };
  metadata: {
    timestamp: number;
    openPositionsCount: number;
    closedPositionsCount: number;
    totalExposure: number;
    reconciliationId: string;
  };
  riskFlags: {
    negativeBalance: boolean;
    exceededCapital: boolean;
    largeDiscrepancy: boolean;
    stalePositions: boolean;
  };
}

export class PortfolioReconciliationService {
  // Production tolerance - much stricter for live money
  private static readonly PRODUCTION_TOLERANCE = 0.001; // $0.001 tolerance
  private static readonly CRITICAL_THRESHOLD = 1.00; // $1.00 critical threshold
  private static readonly HIGH_THRESHOLD = 0.10; // $0.10 high severity threshold
  
  static reconcilePortfolio(portfolio: Portfolio): ReconciliationReport {
    const reconciliationId = `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Portfolio Reconciliation] 🔍 PRODUCTION MODE - Starting reconciliation ${reconciliationId}`);
    console.log(`[Portfolio Reconciliation] 💰 Base Capital: ${portfolio.baseCapital.toFixed(6)}`);
    
    const openPositions = portfolio.positions.filter(p => p.status === 'OPEN');
    const closedPositions = portfolio.positions.filter(p => p.status === 'CLOSED');
    
    // Calculate expected values with high precision
    const expectedUnrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
    const expectedRealizedPnL = closedPositions.reduce((sum, p) => sum + p.realizedPnL, 0);
    const expectedTotalPnL = expectedRealizedPnL + expectedUnrealizedPnL;
    const expectedEquity = portfolio.baseCapital + expectedTotalPnL + portfolio.lockedProfits;
    
    // Calculate expected available balance (equity minus locked funds and margin)
    const totalMarginUsed = openPositions.reduce((sum, p) => sum + Math.abs(p.size * p.currentPrice), 0);
    const expectedAvailableBalance = expectedEquity - portfolio.lockedProfits - totalMarginUsed;
    
    console.log(`[Portfolio Reconciliation] 📊 PRODUCTION CALCULATIONS:`);
    console.log(`  - Expected Unrealized P&L: $${expectedUnrealizedPnL.toFixed(6)}`);
    console.log(`  - Expected Realized P&L: $${expectedRealizedPnL.toFixed(6)}`);
    console.log(`  - Expected Total P&L: $${expectedTotalPnL.toFixed(6)}`);
    console.log(`  - Expected Equity: $${expectedEquity.toFixed(6)}`);
    console.log(`  - Total Margin Used: $${totalMarginUsed.toFixed(6)}`);
    console.log(`  - Expected Available Balance: $${expectedAvailableBalance.toFixed(6)}`);
    
    console.log(`[Portfolio Reconciliation] 📋 ACTUAL VALUES:`);
    console.log(`  - Actual Total P&L: $${portfolio.totalPnL.toFixed(6)}`);
    console.log(`  - Actual Equity: $${portfolio.equity.toFixed(6)}`);
    console.log(`  - Actual Available Balance: $${portfolio.availableBalance.toFixed(6)}`);

    const discrepancies: PortfolioDiscrepancy[] = [];
    
    // Risk flags for production monitoring
    const riskFlags = {
      negativeBalance: portfolio.availableBalance < 0 || expectedAvailableBalance < 0,
      exceededCapital: portfolio.equity > (portfolio.baseCapital * 1.5), // 50% gain threshold
      largeDiscrepancy: false, // Will be set below
      stalePositions: openPositions.some(p => Date.now() - p.timestamp > 3600000) // 1 hour old
    };

    // CRITICAL: Equity validation (most important for live trading)
    const equityDifference = Math.abs(portfolio.equity - expectedEquity);
    if (equityDifference > this.PRODUCTION_TOLERANCE) {
      const severity = equityDifference > this.CRITICAL_THRESHOLD ? 'critical' : 
                      equityDifference > this.HIGH_THRESHOLD ? 'high' : 'medium';
      
      discrepancies.push({
        type: equityDifference > this.CRITICAL_THRESHOLD ? 'critical' : 'calculation',
        field: 'equity',
        expected: expectedEquity,
        actual: portfolio.equity,
        difference: equityDifference,
        severity,
        potentialImpact: equityDifference,
        description: `CRITICAL: Equity mismatch of $${equityDifference.toFixed(6)} - Expected: $${expectedEquity.toFixed(6)}, Actual: $${portfolio.equity.toFixed(6)}`
      });
      
      if (severity === 'critical' || severity === 'high') {
        riskFlags.largeDiscrepancy = true;
      }
    }

    // CRITICAL: Total P&L validation
    const totalPnLDifference = Math.abs(portfolio.totalPnL - expectedTotalPnL);
    if (totalPnLDifference > this.PRODUCTION_TOLERANCE) {
      const severity = totalPnLDifference > this.CRITICAL_THRESHOLD ? 'critical' : 
                      totalPnLDifference > this.HIGH_THRESHOLD ? 'high' : 'medium';
      
      discrepancies.push({
        type: totalPnLDifference > this.CRITICAL_THRESHOLD ? 'critical' : 'calculation',
        field: 'totalPnL',
        expected: expectedTotalPnL,
        actual: portfolio.totalPnL,
        difference: totalPnLDifference,
        severity,
        potentialImpact: totalPnLDifference,
        description: `P&L calculation error: $${totalPnLDifference.toFixed(6)} difference`
      });
    }

    // CRITICAL: Available balance validation
    const balanceDifference = Math.abs(portfolio.availableBalance - expectedAvailableBalance);
    if (balanceDifference > this.PRODUCTION_TOLERANCE) {
      discrepancies.push({
        type: 'calculation',
        field: 'availableBalance',
        expected: expectedAvailableBalance,
        actual: portfolio.availableBalance,
        difference: balanceDifference,
        severity: balanceDifference > this.HIGH_THRESHOLD ? 'high' : 'medium',
        potentialImpact: balanceDifference,
        description: `Available balance mismatch: $${balanceDifference.toFixed(6)}`
      });
    }

    // Validate individual positions with enhanced precision
    openPositions.forEach((position, index) => {
      // Critical data validation
      if (position.currentPrice <= 0) {
        discrepancies.push({
          type: 'critical',
          field: `position[${index}].currentPrice`,
          expected: position.entryPrice,
          actual: position.currentPrice,
          difference: Math.abs(position.currentPrice - position.entryPrice),
          severity: 'critical',
          potentialImpact: Math.abs(position.size * position.entryPrice),
          description: `CRITICAL: Invalid current price for position ${position.id}: $${position.currentPrice}`
        });
      }

      if (position.size <= 0) {
        discrepancies.push({
          type: 'critical',
          field: `position[${index}].size`,
          expected: Math.abs(position.size),
          actual: position.size,
          difference: Math.abs(position.size),
          severity: 'critical',
          potentialImpact: Math.abs(position.size * position.currentPrice),
          description: `CRITICAL: Invalid position size for ${position.id}: ${position.size}`
        });
      }

      // Enhanced P&L calculation validation
      const expectedPositionPnL = position.side === 'BUY'
        ? (position.currentPrice - position.entryPrice) * position.size
        : (position.entryPrice - position.currentPrice) * position.size;
      
      const positionPnLDifference = Math.abs(position.unrealizedPnL - expectedPositionPnL);
      if (positionPnLDifference > this.PRODUCTION_TOLERANCE) {
        const severity = positionPnLDifference > this.CRITICAL_THRESHOLD ? 'critical' : 
                        positionPnLDifference > this.HIGH_THRESHOLD ? 'high' : 'medium';
        
        discrepancies.push({
          type: severity === 'critical' ? 'critical' : 'calculation',
          field: `position[${index}].unrealizedPnL`,
          expected: expectedPositionPnL,
          actual: position.unrealizedPnL,
          difference: positionPnLDifference,
          severity,
          potentialImpact: positionPnLDifference,
          description: `Position ${position.id} P&L error: Expected $${expectedPositionPnL.toFixed(6)}, Got $${position.unrealizedPnL.toFixed(6)}`
        });
      }
    });

    // Critical risk validations
    if (portfolio.availableBalance < -0.01) {
      discrepancies.push({
        type: 'critical',
        field: 'availableBalance',
        expected: 0,
        actual: portfolio.availableBalance,
        difference: Math.abs(portfolio.availableBalance),
        severity: 'critical',
        potentialImpact: Math.abs(portfolio.availableBalance),
        description: `CRITICAL: Negative available balance: $${portfolio.availableBalance.toFixed(6)}`
      });
    }

    // Check for potential margin call situations
    const totalExposure = openPositions.reduce((sum, p) => sum + Math.abs(p.size * p.currentPrice), 0);
    if (totalExposure > portfolio.equity * 3) { // 3:1 leverage threshold
      discrepancies.push({
        type: 'critical',
        field: 'leverage',
        expected: portfolio.equity * 3,
        actual: totalExposure,
        difference: totalExposure - (portfolio.equity * 3),
        severity: 'critical',
        potentialImpact: totalExposure - portfolio.equity,
        description: `CRITICAL: Excessive leverage detected. Exposure: $${totalExposure.toFixed(2)}, Equity: $${portfolio.equity.toFixed(2)}`
      });
    }

    const criticalDiscrepancies = discrepancies.filter(d => d.severity === 'critical');
    const hasBookingErrors = discrepancies.some(d => d.type === 'critical' || d.type === 'data');
    const hasCriticalDiscrepancies = criticalDiscrepancies.length > 0;
    const isConsistent = discrepancies.length === 0;
    
    // Enhanced logging for production
    if (!isConsistent) {
      console.log(`[Portfolio Reconciliation] 🚨 PRODUCTION ALERT: ${discrepancies.length} discrepancies found`);
      console.log(`[Portfolio Reconciliation] ⚠️ Critical Issues: ${criticalDiscrepancies.length}`);
      console.log(`[Portfolio Reconciliation] 💰 Total Potential Impact: $${discrepancies.reduce((sum, d) => sum + d.potentialImpact, 0).toFixed(6)}`);
      
      discrepancies.forEach((discrepancy, i) => {
        const icon = discrepancy.severity === 'critical' ? '🔴' : 
                    discrepancy.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${i + 1}. ${icon} [${discrepancy.severity.toUpperCase()}] ${discrepancy.description} (Impact: $${discrepancy.potentialImpact.toFixed(6)})`);
      });
    } else {
      console.log(`[Portfolio Reconciliation] ✅ PRODUCTION: All calculations validated successfully`);
    }

    return {
      isConsistent,
      hasBookingErrors,
      hasCriticalDiscrepancies,
      discrepancies,
      calculatedValues: {
        expectedEquity,
        expectedTotalPnL,
        expectedUnrealizedPnL,
        expectedRealizedPnL,
        expectedAvailableBalance
      },
      metadata: {
        timestamp: Date.now(),
        openPositionsCount: openPositions.length,
        closedPositionsCount: closedPositions.length,
        totalExposure,
        reconciliationId
      },
      riskFlags
    };
  }

  static createCorrectedPortfolio(portfolio: Portfolio, report: ReconciliationReport): Portfolio {
    console.log(`[Portfolio Reconciliation] 🔧 PRODUCTION: Creating corrected portfolio (ID: ${report.metadata.reconciliationId})`);
    
    // Only apply corrections if they're safe and not critical discrepancies
    const safeToCorrect = !report.hasCriticalDiscrepancies && !report.hasBookingErrors;
    
    if (!safeToCorrect) {
      console.log(`[Portfolio Reconciliation] ⚠️ PRODUCTION WARNING: Not applying automatic corrections due to critical discrepancies`);
      return portfolio; // Return original portfolio if unsafe to correct
    }
    
    const correctedPortfolio: Portfolio = {
      ...portfolio,
      totalPnL: report.calculatedValues.expectedTotalPnL,
      equity: report.calculatedValues.expectedEquity,
      availableBalance: report.calculatedValues.expectedAvailableBalance
    };

    // Fix position calculation errors (only non-critical ones)
    const correctedPositions = portfolio.positions.map(position => {
      if (position.status === 'OPEN') {
        const expectedPnL = position.side === 'BUY'
          ? (position.currentPrice - position.entryPrice) * position.size
          : (position.entryPrice - position.currentPrice) * position.size;
        
        const difference = Math.abs(position.unrealizedPnL - expectedPnL);
        
        // Only correct small differences, not large ones that might indicate data issues
        if (difference <= this.HIGH_THRESHOLD && difference > this.PRODUCTION_TOLERANCE) {
          return {
            ...position,
            unrealizedPnL: expectedPnL
          };
        }
      }
      return position;
    });

    correctedPortfolio.positions = correctedPositions;
    
    console.log(`[Portfolio Reconciliation] ✅ PRODUCTION: Portfolio corrected safely`);
    console.log(`  - Equity: $${portfolio.equity.toFixed(6)} → $${correctedPortfolio.equity.toFixed(6)}`);
    console.log(`  - Available Balance: $${portfolio.availableBalance.toFixed(6)} → $${correctedPortfolio.availableBalance.toFixed(6)}`);
    
    return correctedPortfolio;
  }

  // New method for production risk assessment
  static assessProductionRisk(report: ReconciliationReport): {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    shouldHaltTrading: boolean;
    recommendedActions: string[];
  } {
    const totalImpact = report.discrepancies.reduce((sum, d) => sum + d.potentialImpact, 0);
    const criticalCount = report.discrepancies.filter(d => d.severity === 'critical').length;
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let shouldHaltTrading = false;
    const recommendedActions: string[] = [];

    if (report.hasCriticalDiscrepancies || criticalCount > 0) {
      riskLevel = 'CRITICAL';
      shouldHaltTrading = true;
      recommendedActions.push('HALT ALL TRADING IMMEDIATELY');
      recommendedActions.push('Investigate critical discrepancies');
      recommendedActions.push('Contact system administrator');
    } else if (totalImpact > 10 || report.riskFlags.negativeBalance) {
      riskLevel = 'HIGH';
      shouldHaltTrading = true;
      recommendedActions.push('Suspend new positions');
      recommendedActions.push('Review all calculations');
    } else if (totalImpact > 1 || report.discrepancies.length > 3) {
      riskLevel = 'MEDIUM';
      recommendedActions.push('Monitor closely');
      recommendedActions.push('Review affected positions');
    }

    if (report.riskFlags.stalePositions) {
      recommendedActions.push('Update stale position prices');
    }

    return {
      riskLevel,
      shouldHaltTrading,
      recommendedActions
    };
  }
}
