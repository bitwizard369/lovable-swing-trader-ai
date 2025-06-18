
import { TradingSignal, Position } from '@/types/trading';
import { AdvancedIndicators, MarketContext } from '@/services/advancedTechnicalAnalysis';
import { PredictionOutput } from '@/services/aiPredictionModel';

export interface AutoTradingConfig {
  enabled: boolean;
  maxPositionsPerSymbol: number;
  maxDailyLoss: number;
  emergencyStopEnabled: boolean;
  dryRunMode: boolean;
  confirmBeforeExecution: boolean;
}

export class AutoTradingEngine {
  private config: AutoTradingConfig;
  private dailyPnL: number = 0;
  private isEmergencyStopped: boolean = false;
  private executedToday: number = 0;

  constructor(config: AutoTradingConfig) {
    this.config = config;
    this.resetDailyCounters();
  }

  private resetDailyCounters() {
    const now = new Date();
    const lastReset = localStorage.getItem('lastDailyReset');
    const today = now.toDateString();
    
    if (lastReset !== today) {
      this.dailyPnL = 0;
      this.executedToday = 0;
      localStorage.setItem('lastDailyReset', today);
    }
  }

  updateDailyPnL(pnl: number) {
    this.dailyPnL += pnl;
    
    if (this.config.emergencyStopEnabled && this.dailyPnL <= -this.config.maxDailyLoss) {
      this.triggerEmergencyStop();
    }
  }

  private triggerEmergencyStop() {
    this.isEmergencyStopped = true;
    console.error('[Auto Trading] 🚨 EMERGENCY STOP TRIGGERED - Daily loss limit exceeded');
  }

  canExecuteTrade(
    signal: TradingSignal,
    currentPositions: Position[],
    availableBalance: number
  ): { canExecute: boolean; reason?: string } {
    if (!this.config.enabled) {
      return { canExecute: false, reason: 'Auto trading disabled' };
    }

    if (this.isEmergencyStopped) {
      return { canExecute: false, reason: 'Emergency stop active' };
    }

    if (signal.action === 'HOLD') {
      return { canExecute: false, reason: 'Hold signal - no action needed' };
    }

    const openPositionsForSymbol = currentPositions.filter(
      p => p.symbol === signal.symbol && p.status === 'OPEN'
    ).length;

    if (openPositionsForSymbol >= this.config.maxPositionsPerSymbol) {
      return { canExecute: false, reason: 'Max positions per symbol reached' };
    }

    const positionValue = signal.quantity * signal.price;
    if (positionValue > availableBalance * 0.95) {
      return { canExecute: false, reason: 'Insufficient balance' };
    }

    return { canExecute: true };
  }

  async executeSignal(
    signal: TradingSignal,
    prediction: PredictionOutput,
    executePositionCallback: (signal: TradingSignal, prediction: PredictionOutput) => Promise<Position | null>
  ): Promise<{ success: boolean; position?: Position; error?: string }> {
    try {
      console.log(`[Auto Trading] 🚀 Executing ${signal.action} signal for ${signal.symbol}`);
      
      if (this.config.dryRunMode) {
        console.log('[Auto Trading] 📝 DRY RUN MODE - Signal would be executed:', signal);
        return { success: true };
      }

      const position = await executePositionCallback(signal, prediction);
      
      if (position) {
        this.executedToday++;
        console.log(`[Auto Trading] ✅ Successfully executed trade: ${position.id}`);
        return { success: true, position };
      } else {
        return { success: false, error: 'Failed to create position' };
      }
    } catch (error) {
      console.error('[Auto Trading] ❌ Failed to execute signal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      emergencyStopped: this.isEmergencyStopped,
      dailyPnL: this.dailyPnL,
      executedToday: this.executedToday,
      dryRunMode: this.config.dryRunMode
    };
  }

  updateConfig(newConfig: Partial<AutoTradingConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  resetEmergencyStop() {
    this.isEmergencyStopped = false;
    console.log('[Auto Trading] ✅ Emergency stop reset');
  }
}
