
interface TradingConfiguration {
  // Position Management
  maxPositionSize: number;
  positionSizePercentage: number;
  maxOpenPositions: number;
  
  // Risk Management
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxDailyLoss: number;
  riskPerTrade: number;
  
  // AI/Signal Thresholds
  minProbability: number;
  minConfidence: number;
  
  // Technical Analysis
  useKellyCriterion: boolean;
  adaptiveEntryThreshold: boolean;
  atrBasedTrailingStop: boolean;
  
  // Portfolio
  initialBalance: number;
}

const DEFAULT_CONFIG: TradingConfiguration = {
  maxPositionSize: 5000,
  positionSizePercentage: 50,
  maxOpenPositions: 5,
  stopLossPercentage: 0.6,
  takeProfitPercentage: 1.5,
  maxDailyLoss: 500,
  riskPerTrade: 0.02,
  minProbability: 0.46,
  minConfidence: 0.25,
  useKellyCriterion: true,
  adaptiveEntryThreshold: true,
  atrBasedTrailingStop: true,
  initialBalance: 10000
};

export class ConfigurationService {
  private static instance: ConfigurationService;
  private config: TradingConfiguration;
  private callbacks: Set<(config: TradingConfiguration) => void> = new Set();

  private constructor() {
    this.config = this.loadConfiguration();
    console.log('[Configuration Service] 🔧 Configuration loaded:', this.config);
  }

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  private loadConfiguration(): TradingConfiguration {
    // Priority order:
    // 1. Environment variables (build-time configuration)
    // 2. Local storage (user overrides)
    // 3. Default configuration

    let config = { ...DEFAULT_CONFIG };

    // Check for environment-based overrides
    if (typeof window !== 'undefined') {
      try {
        const storedConfig = localStorage.getItem('trading_configuration');
        if (storedConfig) {
          const parsedConfig = JSON.parse(storedConfig);
          config = { ...config, ...parsedConfig };
          console.log('[Configuration Service] 📋 Loaded config from localStorage');
        }
      } catch (error) {
        console.error('[Configuration Service] Error loading from localStorage:', error);
      }
    }

    // Validate configuration bounds
    return this.validateConfiguration(config);
  }

  private validateConfiguration(config: TradingConfiguration): TradingConfiguration {
    // Ensure sane bounds
    return {
      ...config,
      stopLossPercentage: Math.max(0.1, Math.min(10, config.stopLossPercentage)),
      takeProfitPercentage: Math.max(0.1, Math.min(20, config.takeProfitPercentage)),
      positionSizePercentage: Math.max(1, Math.min(100, config.positionSizePercentage)),
      minProbability: Math.max(0.1, Math.min(1, config.minProbability)),
      minConfidence: Math.max(0.1, Math.min(1, config.minConfidence)),
      maxOpenPositions: Math.max(1, Math.min(20, config.maxOpenPositions)),
      initialBalance: Math.max(100, config.initialBalance)
    };
  }

  getConfiguration(): TradingConfiguration {
    return { ...this.config }; // Return a copy to prevent external mutations
  }

  updateConfiguration(updates: Partial<TradingConfiguration>): void {
    const newConfig = { ...this.config, ...updates };
    const validatedConfig = this.validateConfiguration(newConfig);
    
    this.config = validatedConfig;
    
    // Persist to localStorage
    try {
      localStorage.setItem('trading_configuration', JSON.stringify(validatedConfig));
      console.log('[Configuration Service] 💾 Configuration saved to localStorage');
    } catch (error) {
      console.error('[Configuration Service] Error saving to localStorage:', error);
    }

    // Notify subscribers
    this.notifyCallbacks();
  }

  subscribe(callback: (config: TradingConfiguration) => void): () => void {
    this.callbacks.add(callback);
    
    // Immediately provide current config
    callback(this.config);

    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        console.error('[Configuration Service] Error in callback:', error);
      }
    });
  }

  // For debugging
  resetToDefaults(): void {
    this.config = { ...DEFAULT_CONFIG };
    try {
      localStorage.removeItem('trading_configuration');
    } catch (error) {
      console.error('[Configuration Service] Error clearing localStorage:', error);
    }
    this.notifyCallbacks();
    console.log('[Configuration Service] 🔄 Reset to default configuration');
  }

  exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfiguration(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson) as Partial<TradingConfiguration>;
      this.updateConfiguration(importedConfig);
      console.log('[Configuration Service] 📥 Configuration imported successfully');
      return true;
    } catch (error) {
      console.error('[Configuration Service] Error importing configuration:', error);
      return false;
    }
  }
}
