
import { Position } from '@/types/trading';
import { AdvancedIndicators } from '@/services/advancedTechnicalAnalysis';
import { PredictionOutput } from '@/services/aiPredictionModel';

export interface PositionManagerConfig {
  enableTrailingStops: boolean;
  trailingStopATRMultiplier: number;
  enableTakeProfit: boolean;
  takeProfitMultiplier: number;
  enableStopLoss: boolean;
  stopLossMultiplier: number;
  enablePartialProfits: boolean;
  partialProfitLevels: number[];
}

export interface ManagedPosition {
  position: Position;
  prediction: PredictionOutput;
  entryTime: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPrice?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  partialProfitsTaken: number;
  exchangeFees: number;
  profitLockTriggered: boolean;
}

export class PositionManager {
  private positions: Map<string, ManagedPosition> = new Map();
  private config: PositionManagerConfig;

  constructor(config: PositionManagerConfig) {
    this.config = config;
  }

  addPosition(
    position: Position, 
    prediction: PredictionOutput, 
    indicators?: AdvancedIndicators
  ): ManagedPosition {
    // Calculate expected exchange fees for this position
    const tradeValue = position.size * position.entryPrice;
    const exchangeFees = tradeValue * 0.002; // 0.2% total fees (0.1% each for buy and sell)
    
    const managedPosition: ManagedPosition = {
      position,
      prediction,
      entryTime: Date.now(),
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      partialProfitsTaken: 0,
      exchangeFees,
      profitLockTriggered: false
    };

    // Set initial stop loss with improved calculation that accounts for fees
    if (this.config.enableStopLoss) {
      const atrDistance = indicators?.atr ? indicators.atr * this.config.stopLossMultiplier : 0;
      const percentageDistance = position.entryPrice * (this.config.stopLossMultiplier / 100);
      
      // Ensure stop loss accounts for exchange fees to prevent immediate losses
      const feeAdjustment = exchangeFees / position.size;
      const stopDistance = Math.max(atrDistance, percentageDistance, feeAdjustment * 1.5);

      managedPosition.stopLossPrice = position.side === 'BUY'
        ? position.entryPrice - stopDistance
        : position.entryPrice + stopDistance;
        
      console.log(`[Position Manager] 📊 Fee-adjusted stop loss - Fees: ${exchangeFees.toFixed(2)}, Fee adjustment: ${feeAdjustment.toFixed(4)}, Final stop distance: ${stopDistance.toFixed(2)}`);
    }

    if (this.config.enableTakeProfit) {
      // More aggressive take profit that ensures profitability after fees
      const expectedProfitDistance = Math.abs(prediction.expectedReturn / 100 * position.entryPrice);
      const minProfitDistance = position.entryPrice * (this.config.takeProfitMultiplier / 100);
      
      // Ensure take profit covers fees plus meaningful profit
      const feeAdjustment = exchangeFees / position.size;
      const minProfitableDistance = feeAdjustment * 2; // 2x fees for meaningful profit
      
      const profitDistance = Math.max(expectedProfitDistance, minProfitDistance, minProfitableDistance);

      managedPosition.takeProfitPrice = position.side === 'BUY'
        ? position.entryPrice + profitDistance
        : position.entryPrice - profitDistance;
        
      console.log(`[Position Manager] 🎯 Fee-aware take profit - Expected: ${expectedProfitDistance.toFixed(2)}, Min: ${minProfitDistance.toFixed(2)}, Fee-adjusted: ${minProfitableDistance.toFixed(2)}, Used: ${profitDistance.toFixed(2)}`);
    }

    this.positions.set(position.id, managedPosition);
    console.log(`[Position Manager] 📊 Added position ${position.id} with fee consideration - Entry: ${position.entryPrice.toFixed(2)}, Expected fees: ${exchangeFees.toFixed(2)}`);
    
    return managedPosition;
  }

  updatePosition(
    positionId: string, 
    currentPrice: number, 
    indicators?: AdvancedIndicators
  ): { shouldExit: boolean; exitReason?: string; isPartialExit?: boolean; exitQuantity?: number } {
    const managedPos = this.positions.get(positionId);
    if (!managedPos) {
      return { shouldExit: false };
    }

    const { position } = managedPos;
    const priceChange = position.side === 'BUY'
      ? (currentPrice - position.entryPrice) / position.entryPrice
      : (position.entryPrice - currentPrice) / position.entryPrice;

    const grossPnL = Math.abs(currentPrice - position.entryPrice) * position.size * (priceChange >= 0 ? 1 : -1);
    const netPnL = grossPnL - managedPos.exchangeFees;

    // Update MFE and MAE
    managedPos.maxFavorableExcursion = Math.max(managedPos.maxFavorableExcursion, Math.max(0, priceChange));
    managedPos.maxAdverseExcursion = Math.min(managedPos.maxAdverseExcursion, Math.min(0, priceChange));

    // Check for profit lock trigger (when position becomes profitable after fees)
    if (!managedPos.profitLockTriggered && netPnL > 0) {
      managedPos.profitLockTriggered = true;
      console.log(`[Position Manager] 🔒 Profit lock conditions met for ${positionId} - Net P&L: ${netPnL.toFixed(2)}`);
    }

    // Update trailing stop with fee-aware calculations
    if (this.config.enableTrailingStops && indicators?.atr && managedPos.profitLockTriggered) {
      const atrDistance = indicators.atr * this.config.trailingStopATRMultiplier;
      const feeBuffer = managedPos.exchangeFees / position.size;
      const minTrailingDistance = Math.max(atrDistance, feeBuffer * 1.5);
      
      if (position.side === 'BUY') {
        const potentialStop = currentPrice - minTrailingDistance;
        managedPos.trailingStopPrice = Math.max(managedPos.trailingStopPrice || 0, potentialStop);
      } else {
        const potentialStop = currentPrice + minTrailingDistance;
        managedPos.trailingStopPrice = Math.min(managedPos.trailingStopPrice || Infinity, potentialStop);
      }
    }

    console.log(`[Position Manager] 💰 Position ${positionId} - Current: ${currentPrice.toFixed(2)}, Gross P&L: ${grossPnL.toFixed(2)}, Net P&L: ${netPnL.toFixed(2)}, Fees: ${managedPos.exchangeFees.toFixed(2)}`);
    
    // Exit condition checks with fee awareness
    if (managedPos.stopLossPrice) {
      const hitStopLoss = position.side === 'BUY'
        ? currentPrice <= managedPos.stopLossPrice
        : currentPrice >= managedPos.stopLossPrice;
      
      if (hitStopLoss) {
        console.log(`[Position Manager] ❌ Stop loss triggered for ${positionId} - Will lose approximately ${managedPos.exchangeFees.toFixed(2)} in fees`);
        return { shouldExit: true, exitReason: 'Stop loss triggered' };
      }
    }

    if (managedPos.trailingStopPrice) {
      const hitTrailingStop = position.side === 'BUY'
        ? currentPrice <= managedPos.trailingStopPrice
        : currentPrice >= managedPos.trailingStopPrice;
      
      if (hitTrailingStop) {
        console.log(`[Position Manager] 📉 Trailing stop triggered for ${positionId} - Protecting profits after fees`);
        return { shouldExit: true, exitReason: 'Trailing stop triggered' };
      }
    }

    if (managedPos.takeProfitPrice) {
      const hitTakeProfit = position.side === 'BUY'
        ? currentPrice >= managedPos.takeProfitPrice
        : currentPrice <= managedPos.takeProfitPrice;
      
      if (hitTakeProfit) {
        console.log(`[Position Manager] ✅ Take profit triggered for ${positionId} - Net profit: ${netPnL.toFixed(2)}`);
        return { shouldExit: true, exitReason: 'Take profit triggered' };
      }
    }

    // Partial profits with fee consideration
    if (this.config.enablePartialProfits && managedPos.partialProfitsTaken < this.config.partialProfitLevels.length) {
      const nextProfitLevel = this.config.partialProfitLevels[managedPos.partialProfitsTaken] / 100;
      const requiredGainForLevel = nextProfitLevel + (managedPos.exchangeFees / (position.size * position.entryPrice));
      
      if (priceChange >= requiredGainForLevel) {
        managedPos.partialProfitsTaken++;
        console.log(`[Position Manager] 💰 Fee-adjusted partial profit triggered for ${positionId} at ${(nextProfitLevel * 100).toFixed(1)}%`);
        return { 
          shouldExit: true, 
          exitReason: `Partial profit at ${(nextProfitLevel * 100).toFixed(1)}%`,
          isPartialExit: true,
          exitQuantity: position.size * 0.33
        };
      }
    }

    // Extended time-based exit
    const holdingTime = (Date.now() - managedPos.entryTime) / 1000;
    const maxHoldTime = Math.min(managedPos.prediction.timeHorizon, 600);
    
    if (holdingTime >= maxHoldTime) {
      console.log(`[Position Manager] ⏰ Time limit reached for ${positionId} - Final net P&L: ${netPnL.toFixed(2)}`);
      return { shouldExit: true, exitReason: 'Time horizon reached' };
    }

    return { shouldExit: false };
  }

  removePosition(positionId: string): ManagedPosition | undefined {
    const managedPos = this.positions.get(positionId);
    this.positions.delete(positionId);
    return managedPos;
  }

  getAllPositions(): ManagedPosition[] {
    return Array.from(this.positions.values());
  }

  updateConfig(newConfig: Partial<PositionManagerConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('[Position Manager] ⚙️ Configuration updated with enhanced fee awareness');
  }
}
