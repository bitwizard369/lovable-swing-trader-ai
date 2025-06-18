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
    const managedPosition: ManagedPosition = {
      position,
      prediction,
      entryTime: Date.now(),
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      partialProfitsTaken: 0
    };

    // Set initial stop loss with more reasonable distance
    if (this.config.enableStopLoss) {
      // Use ATR-based stop loss with minimum distance to prevent immediate triggers
      const atrDistance = indicators?.atr ? indicators.atr * this.config.stopLossMultiplier : 0;
      const percentageDistance = position.entryPrice * (this.config.stopLossMultiplier / 100);
      
      // Use the larger of ATR-based or percentage-based distance, with a minimum of $50
      const stopDistance = Math.max(atrDistance, percentageDistance, 50);

      managedPosition.stopLossPrice = position.side === 'BUY'
        ? position.entryPrice - stopDistance
        : position.entryPrice + stopDistance;
        
      console.log(`[Position Manager] 📊 Stop loss calculated - ATR: ${atrDistance.toFixed(2)}, Percentage: ${percentageDistance.toFixed(2)}, Used: ${stopDistance.toFixed(2)}`);
    }

    if (this.config.enableTakeProfit) {
      // More aggressive take profit based on expected return with minimum distance
      const expectedProfitDistance = Math.abs(prediction.expectedReturn / 100 * position.entryPrice);
      const minProfitDistance = position.entryPrice * (this.config.takeProfitMultiplier / 100);
      const profitDistance = Math.max(expectedProfitDistance, minProfitDistance, 100); // Minimum $100 profit target

      managedPosition.takeProfitPrice = position.side === 'BUY'
        ? position.entryPrice + profitDistance
        : position.entryPrice - profitDistance;
        
      console.log(`[Position Manager] 🎯 Take profit calculated - Expected: ${expectedProfitDistance.toFixed(2)}, Min: ${minProfitDistance.toFixed(2)}, Used: ${profitDistance.toFixed(2)}`);
    }

    this.positions.set(position.id, managedPosition);
    console.log(`[Position Manager] 📊 Added position ${position.id} - Entry: ${position.entryPrice.toFixed(2)}, SL: ${managedPosition.stopLossPrice?.toFixed(2)}, TP: ${managedPosition.takeProfitPrice?.toFixed(2)}`);
    
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

    // Update MFE and MAE
    managedPos.maxFavorableExcursion = Math.max(managedPos.maxFavorableExcursion, Math.max(0, priceChange));
    managedPos.maxAdverseExcursion = Math.min(managedPos.maxAdverseExcursion, Math.min(0, priceChange));

    // Update trailing stop with larger distances
    if (this.config.enableTrailingStops && indicators?.atr) {
      const atrDistance = indicators.atr * this.config.trailingStopATRMultiplier;
      const minTrailingDistance = Math.max(atrDistance, 75); // Minimum $75 trailing distance
      
      if (position.side === 'BUY') {
        const potentialStop = currentPrice - minTrailingDistance;
        managedPos.trailingStopPrice = Math.max(managedPos.trailingStopPrice || 0, potentialStop);
      } else {
        const potentialStop = currentPrice + minTrailingDistance;
        managedPos.trailingStopPrice = Math.min(managedPos.trailingStopPrice || Infinity, potentialStop);
      }
    }

    // Check exit conditions with better logging
    const priceDiff = Math.abs(currentPrice - position.entryPrice);
    console.log(`[Position Manager] 💰 Position ${positionId} - Current: ${currentPrice.toFixed(2)}, Entry: ${position.entryPrice.toFixed(2)}, Diff: ${priceDiff.toFixed(2)}, P&L%: ${(priceChange * 100).toFixed(3)}%`);
    
    // Stop loss check
    if (managedPos.stopLossPrice) {
      const hitStopLoss = position.side === 'BUY'
        ? currentPrice <= managedPos.stopLossPrice
        : currentPrice >= managedPos.stopLossPrice;
      
      if (hitStopLoss) {
        console.log(`[Position Manager] ❌ Stop loss triggered for ${positionId} - Current: ${currentPrice.toFixed(2)}, SL: ${managedPos.stopLossPrice.toFixed(2)}`);
        return { shouldExit: true, exitReason: 'Stop loss triggered' };
      }
    }

    // Trailing stop check
    if (managedPos.trailingStopPrice) {
      const hitTrailingStop = position.side === 'BUY'
        ? currentPrice <= managedPos.trailingStopPrice
        : currentPrice >= managedPos.trailingStopPrice;
      
      if (hitTrailingStop) {
        console.log(`[Position Manager] 📉 Trailing stop triggered for ${positionId} - Current: ${currentPrice.toFixed(2)}, Trailing: ${managedPos.trailingStopPrice.toFixed(2)}`);
        return { shouldExit: true, exitReason: 'Trailing stop triggered' };
      }
    }

    // Take profit check
    if (managedPos.takeProfitPrice) {
      const hitTakeProfit = position.side === 'BUY'
        ? currentPrice >= managedPos.takeProfitPrice
        : currentPrice <= managedPos.takeProfitPrice;
      
      if (hitTakeProfit) {
        console.log(`[Position Manager] ✅ Take profit triggered for ${positionId} - Current: ${currentPrice.toFixed(2)}, TP: ${managedPos.takeProfitPrice.toFixed(2)}`);
        return { shouldExit: true, exitReason: 'Take profit triggered' };
      }
    }

    // Partial profits check
    if (this.config.enablePartialProfits && managedPos.partialProfitsTaken < this.config.partialProfitLevels.length) {
      const nextProfitLevel = this.config.partialProfitLevels[managedPos.partialProfitsTaken] / 100;
      if (priceChange >= nextProfitLevel) {
        managedPos.partialProfitsTaken++;
        console.log(`[Position Manager] 💰 Partial profit triggered for ${positionId} at ${(nextProfitLevel * 100).toFixed(1)}%`);
        return { 
          shouldExit: true, 
          exitReason: `Partial profit at ${(nextProfitLevel * 100).toFixed(1)}%`,
          isPartialExit: true,
          exitQuantity: position.size * 0.33
        };
      }
    }

    // Extended time-based exit (longer holding time)
    const holdingTime = (Date.now() - managedPos.entryTime) / 1000;
    const maxHoldTime = Math.min(managedPos.prediction.timeHorizon, 600); // Extended to 10 minutes max
    
    if (holdingTime >= maxHoldTime) {
      console.log(`[Position Manager] ⏰ Time limit reached for ${positionId} - Held for ${holdingTime.toFixed(0)}s`);
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
  }
}
