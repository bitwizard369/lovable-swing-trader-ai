
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

    // Set initial stop loss and take profit
    if (this.config.enableStopLoss) {
      const stopDistance = indicators?.atr 
        ? indicators.atr * this.config.stopLossMultiplier
        : position.entryPrice * 0.01; // 1% fallback

      managedPosition.stopLossPrice = position.side === 'BUY'
        ? position.entryPrice - stopDistance
        : position.entryPrice + stopDistance;
    }

    if (this.config.enableTakeProfit) {
      const profitDistance = Math.max(
        prediction.expectedReturn / 100 * position.entryPrice,
        position.entryPrice * 0.015 // Minimum 1.5%
      );

      managedPosition.takeProfitPrice = position.side === 'BUY'
        ? position.entryPrice + profitDistance
        : position.entryPrice - profitDistance;
    }

    this.positions.set(position.id, managedPosition);
    console.log(`[Position Manager] 📊 Added position ${position.id} with SL: ${managedPosition.stopLossPrice?.toFixed(2)}, TP: ${managedPosition.takeProfitPrice?.toFixed(2)}`);
    
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

    // Update trailing stop
    if (this.config.enableTrailingStops && indicators?.atr) {
      const atrDistance = indicators.atr * this.config.trailingStopATRMultiplier;
      
      if (position.side === 'BUY') {
        const potentialStop = currentPrice - atrDistance;
        managedPos.trailingStopPrice = Math.max(managedPos.trailingStopPrice || 0, potentialStop);
      } else {
        const potentialStop = currentPrice + atrDistance;
        managedPos.trailingStopPrice = Math.min(managedPos.trailingStopPrice || Infinity, potentialStop);
      }
    }

    // Check exit conditions
    
    // Stop loss check
    if (managedPos.stopLossPrice) {
      const hitStopLoss = position.side === 'BUY'
        ? currentPrice <= managedPos.stopLossPrice
        : currentPrice >= managedPos.stopLossPrice;
      
      if (hitStopLoss) {
        return { shouldExit: true, exitReason: 'Stop loss triggered' };
      }
    }

    // Trailing stop check
    if (managedPos.trailingStopPrice) {
      const hitTrailingStop = position.side === 'BUY'
        ? currentPrice <= managedPos.trailingStopPrice
        : currentPrice >= managedPos.trailingStopPrice;
      
      if (hitTrailingStop) {
        return { shouldExit: true, exitReason: 'Trailing stop triggered' };
      }
    }

    // Take profit check
    if (managedPos.takeProfitPrice) {
      const hitTakeProfit = position.side === 'BUY'
        ? currentPrice >= managedPos.takeProfitPrice
        : currentPrice <= managedPos.takeProfitPrice;
      
      if (hitTakeProfit) {
        return { shouldExit: true, exitReason: 'Take profit triggered' };
      }
    }

    // Partial profits check
    if (this.config.enablePartialProfits && managedPos.partialProfitsTaken < this.config.partialProfitLevels.length) {
      const nextProfitLevel = this.config.partialProfitLevels[managedPos.partialProfitsTaken] / 100;
      if (priceChange >= nextProfitLevel) {
        managedPos.partialProfitsTaken++;
        return { 
          shouldExit: true, 
          exitReason: `Partial profit at ${(nextProfitLevel * 100).toFixed(1)}%`,
          isPartialExit: true,
          exitQuantity: position.size * 0.33
        };
      }
    }

    // Time-based exit (max holding time from prediction)
    const holdingTime = (Date.now() - managedPos.entryTime) / 1000;
    const maxHoldTime = Math.min(managedPos.prediction.timeHorizon, 300); // Max 5 minutes
    
    if (holdingTime >= maxHoldTime) {
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
