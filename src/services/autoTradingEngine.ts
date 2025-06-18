
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
  private dailyProfitsLocked: number = 0;
  private isEmergencyStopped: boolean = false;
  private executedToday: number = 0;
  private dailyWins: number = 0;
  private dailyTrades: number = 0;

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
      this.dailyProfitsLocked = 0;
      this.executedToday = 0;
      this.dailyWins = 0;
      this.dailyTrades = 0;
      localStorage.setItem('lastDailyReset', today);
      console.log('[Auto Trading] 🔄 Daily counters reset for new trading day');
    }
  }

  updateDailyPnL(pnl: number, isWin: boolean = false, profitsLocked: number = 0) {
    this.dailyPnL += pnl;
    this.dailyTrades++;
    
    if (profitsLocked > 0) {
      this.dailyProfitsLocked += profitsLocked;
      console.log(`[Auto Trading] 🔒 Daily profits locked: ${this.dailyProfitsLocked.toFixed(2)} (+${profitsLocked.toFixed(2)})`);
    }
    
    if (isWin) {
      this.dailyWins++;
    }
    
    const currentWinRate = this.dailyTrades > 0 ? (this.dailyWins / this.dailyTrades) * 100 : 0;
    console.log(`[Auto Trading] 📊 Daily stats - P&L: ${this.dailyPnL.toFixed(2)}, Locked: ${this.dailyProfitsLocked.toFixed(2)}, Win Rate: ${currentWinRate.toFixed(1)}% (${this.dailyWins}/${this.dailyTrades})`);
    
    if (this.config.emergencyStopEnabled && this.dailyPnL <= -this.config.maxDailyLoss) {
      this.triggerEmergencyStop();
    }
  }

  private triggerEmergencyStop() {
    this.isEmergencyStopped = true;
    console.error(`[Auto Trading] 🚨 EMERGENCY STOP TRIGGERED - Daily loss: ${this.dailyPnL.toFixed(2)}, Locked profits: ${this.dailyProfitsLocked.toFixed(2)}`);
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
      return { canExecute: false, reason: 'Insufficient balance for dynamic position size' };
    }

    console.log(`[Auto Trading] ✅ Trade validation passed - Position value: ${positionValue.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`);
    return { canExecute: true };
  }

  async executeSignal(
    signal: TradingSignal,
    prediction: PredictionOutput,
    executePositionCallback: (signal: TradingSignal, prediction: PredictionOutput) => Promise<Position | null>
  ): Promise<{ success: boolean; position?: Position; error?: string }> {
    try {
      console.log(`[Auto Trading] 🚀 Executing ${signal.action} signal for ${signal.symbol} - Size: ${signal.quantity.toFixed(6)}`);
      
      if (this.config.dryRunMode) {
        console.log('[Auto Trading] 📝 DRY RUN MODE - Signal would be executed:', signal);
        return { success: true };
      }

      const position = await executePositionCallback(signal, prediction);
      
      if (position) {
        this.executedToday++;
        console.log(`[Auto Trading] ✅ Successfully executed trade: ${position.id} with enhanced profit locking`);
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
    const currentWinRate = this.dailyTrades > 0 ? (this.dailyWins / this.dailyTrades) * 100 : 0;
    
    return {
      enabled: this.config.enabled,
      emergencyStopped: this.isEmergencyStopped,
      dailyPnL: this.dailyPnL,
      dailyProfitsLocked: this.dailyProfitsLocked,
      executedToday: this.executedToday,
      dailyWins: this.dailyWins,
      dailyTrades: this.dailyTrades,
      dailyWinRate: currentWinRate,
      dryRunMode: this.config.dryRunMode
    };
  }

  updateConfig(newConfig: Partial<AutoTradingConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('[Auto Trading] ⚙️ Configuration updated with profit locking support');
  }

  resetEmergencyStop() {
    this.isEmergencyStopped = false;
    console.log('[Auto Trading] ✅ Emergency stop reset - Profit locking system remains active');
  }
}
