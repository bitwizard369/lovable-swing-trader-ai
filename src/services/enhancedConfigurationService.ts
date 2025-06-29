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
  
  // WebSocket Configuration
  wsReconnectAttempts: number;
  wsMessageThrottleMs: number;
  wsHeartbeatIntervalMs: number;
  
  // Performance Optimization
  orderBookDepthLimit: number;
  priceUpdateThrottleMs: number;
  maxSignalHistory: number;
  
  // UI Preferences
  theme: 'light' | 'dark' | 'auto';
  defaultSymbol: string;
  autoConnect: boolean;
  showAdvancedMetrics: boolean;
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
  initialBalance: 10000,
  wsReconnectAttempts: 10,
  wsMessageThrottleMs: 16,
  wsHeartbeatIntervalMs: 30000,
  orderBookDepthLimit: 20,
  priceUpdateThrottleMs: 100,
  maxSignalHistory: 100,
  theme: 'auto',
  defaultSymbol: 'btcusdt',
  autoConnect: true,
  showAdvancedMetrics: false
};

interface ConfigValidationRule {
  field: keyof TradingConfiguration;
  min?: number;
  max?: number;
  allowedValues?: any[];
  required?: boolean;
}

const VALIDATION_RULES: ConfigValidationRule[] = [
  { field: 'stopLossPercentage', min: 0.1, max: 10, required: true },
  { field: 'takeProfitPercentage', min: 0.1, max: 20, required: true },
  { field: 'positionSizePercentage', min: 1, max: 100, required: true },
  { field: 'minProbability', min: 0.1, max: 1, required: true },
  { field: 'minConfidence', min: 0.1, max: 1, required: true },
  { field: 'maxOpenPositions', min: 1, max: 20, required: true },
  { field: 'initialBalance', min: 100, required: true },
  { field: 'wsReconnectAttempts', min: 1, max: 50, required: true },
  { field: 'wsMessageThrottleMs', min: 1, max: 1000, required: true },
  { field: 'orderBookDepthLimit', min: 5, max: 100, required: true },
  { field: 'maxSignalHistory', min: 10, max: 1000, required: true },
  { field: 'theme', allowedValues: ['light', 'dark', 'auto'], required: true }
];

interface ConfigurationEvent {
  type: 'update' | 'reset' | 'import' | 'export';
  timestamp: number;
  changes?: Partial<TradingConfiguration>;
}

export class EnhancedConfigurationService {
  private static instance: EnhancedConfigurationService;
  private config: TradingConfiguration;
  private callbacks: Set<(config: TradingConfiguration) => void> = new Set();
  private validationCallbacks: Set<(errors: string[]) => void> = new Set();
  private eventHistory: ConfigurationEvent[] = [];
  private isDirty = false;
  private saveTimer: number | null = null;

  private constructor() {
    this.config = this.loadConfiguration();
    this.startAutoSave();
    console.log('[Enhanced Configuration] 🔧 Configuration service initialized');
  }

  static getInstance(): EnhancedConfigurationService {
    if (!EnhancedConfigurationService.instance) {
      EnhancedConfigurationService.instance = new EnhancedConfigurationService();
    }
    return EnhancedConfigurationService.instance;
  }

  private loadConfiguration(): TradingConfiguration {
    let config = { ...DEFAULT_CONFIG };

    try {
      // Try to load from localStorage
      if (typeof window !== 'undefined') {
        const storedConfig = localStorage.getItem('enhanced_trading_configuration');
        if (storedConfig) {
          const parsedConfig = JSON.parse(storedConfig);
          config = { ...config, ...parsedConfig };
          console.log('[Enhanced Configuration] 📋 Loaded from localStorage');
        }
      }
    } catch (error) {
      console.error('[Enhanced Configuration] Error loading from localStorage:', error);
    }

    // Validate and clean the configuration
    const { validatedConfig, errors } = this.validateConfiguration(config);
    
    if (errors.length > 0) {
      console.warn('[Enhanced Configuration] Validation errors found:', errors);
    }

    return validatedConfig;
  }

  private validateConfiguration(config: Partial<TradingConfiguration>): {
    validatedConfig: TradingConfiguration;
    errors: string[];
  } {
    const errors: string[] = [];
    const validatedConfig = { ...DEFAULT_CONFIG };

    VALIDATION_RULES.forEach(rule => {
      const value = config[rule.field];
      
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${rule.field} is required`);
        return;
      }
      
      if (value !== undefined && value !== null) {
        // Type-specific validation
        if (typeof value === 'number') {
          if (rule.min !== undefined && value < rule.min) {
            errors.push(`${rule.field} must be at least ${rule.min}`);
            validatedConfig[rule.field] = rule.min as any;
          } else if (rule.max !== undefined && value > rule.max) {
            errors.push(`${rule.field} must be at most ${rule.max}`);
            validatedConfig[rule.field] = rule.max as any;
          } else {
            validatedConfig[rule.field] = value as any;
          }
        } else if (rule.allowedValues && !rule.allowedValues.includes(value)) {
          errors.push(`${rule.field} must be one of: ${rule.allowedValues.join(', ')}`);
        } else {
          validatedConfig[rule.field] = value as any;
        }
      }
    });

    // Copy over fields not in validation rules
    Object.keys(config).forEach(key => {
      const field = key as keyof TradingConfiguration;
      if (!VALIDATION_RULES.find(rule => rule.field === field) && config[field] !== undefined) {
        validatedConfig[field] = config[field] as any;
      }
    });

    return { validatedConfig, errors };
  }

  getConfiguration(): TradingConfiguration {
    return { ...this.config };
  }

  updateConfiguration(updates: Partial<TradingConfiguration>, skipValidation = false): {
    success: boolean;
    errors: string[];
  } {
    const newConfig = { ...this.config, ...updates };
    
    if (!skipValidation) {
      const { validatedConfig, errors } = this.validateConfiguration(newConfig);
      
      if (errors.length > 0) {
        this.notifyValidationCallbacks(errors);
        return { success: false, errors };
      }
      
      this.config = validatedConfig;
    } else {
      this.config = newConfig as TradingConfiguration;
    }

    this.isDirty = true;
    this.recordEvent({ type: 'update', timestamp: Date.now(), changes: updates });
    this.notifyCallbacks();
    
    console.log('[Enhanced Configuration] 💾 Configuration updated:', updates);
    return { success: true, errors: [] };
  }

  private startAutoSave() {
    // Auto-save every 5 seconds if dirty
    setInterval(() => {
      if (this.isDirty) {
        this.saveToStorage();
      }
    }, 5000);
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('enhanced_trading_configuration', JSON.stringify(this.config));
        this.isDirty = false;
        console.log('[Enhanced Configuration] 💾 Auto-saved to localStorage');
      }
    } catch (error) {
      console.error('[Enhanced Configuration] Error saving to localStorage:', error);
    }
  }

  subscribe(callback: (config: TradingConfiguration) => void): () => void {
    this.callbacks.add(callback);
    callback(this.config); // Immediately provide current config
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  subscribeToValidation(callback: (errors: string[]) => void): () => void {
    this.validationCallbacks.add(callback);
    
    return () => {
      this.validationCallbacks.delete(callback);
    };
  }

  private notifyCallbacks(): void {
    this.callbacks.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        console.error('[Enhanced Configuration] Error in callback:', error);
      }
    });
  }

  private notifyValidationCallbacks(errors: string[]): void {
    this.validationCallbacks.forEach(callback => {
      try {
        callback(errors);
      } catch (error) {
        console.error('[Enhanced Configuration] Error in validation callback:', error);
      }
    });
  }

  private recordEvent(event: ConfigurationEvent): void {
    this.eventHistory.push(event);
    // Keep only last 100 events
    if (this.eventHistory.length > 100) {
      this.eventHistory = this.eventHistory.slice(-100);
    }
  }

  resetToDefaults(): { success: boolean; errors: string[] } {
    this.config = { ...DEFAULT_CONFIG };
    this.isDirty = true;
    this.recordEvent({ type: 'reset', timestamp: Date.now() });
    this.notifyCallbacks();
    
    console.log('[Enhanced Configuration] 🔄 Reset to defaults');
    return { success: true, errors: [] };
  }

  exportConfiguration(): string {
    const exportData = {
      config: this.config,
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    
    this.recordEvent({ type: 'export', timestamp: Date.now() });
    return JSON.stringify(exportData, null, 2);
  }

  importConfiguration(configJson: string): { success: boolean; errors: string[] } {
    try {
      const importData = JSON.parse(configJson);
      const configToImport = importData.config || importData; // Support both formats
      
      const result = this.updateConfiguration(configToImport);
      
      if (result.success) {
        this.recordEvent({ type: 'import', timestamp: Date.now() });
        console.log('[Enhanced Configuration] 📥 Configuration imported successfully');
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Import failed: ${error}`;
      console.error('[Enhanced Configuration]', errorMsg);
      return { success: false, errors: [errorMsg] };
    }
  }

  getValidationRules(): ConfigValidationRule[] {
    return [...VALIDATION_RULES];
  }

  getEventHistory(): ConfigurationEvent[] {
    return [...this.eventHistory];
  }

  // Utility methods for specific config sections
  getRiskManagementConfig() {
    return {
      stopLossPercentage: this.config.stopLossPercentage,
      takeProfitPercentage: this.config.takeProfitPercentage,
      maxDailyLoss: this.config.maxDailyLoss,
      riskPerTrade: this.config.riskPerTrade
    };
  }

  getWebSocketConfig() {
    return {
      wsReconnectAttempts: this.config.wsReconnectAttempts,
      wsMessageThrottleMs: this.config.wsMessageThrottleMs,
      wsHeartbeatIntervalMs: this.config.wsHeartbeatIntervalMs
    };
  }

  getPerformanceConfig() {
    return {
      orderBookDepthLimit: this.config.orderBookDepthLimit,
      priceUpdateThrottleMs: this.config.priceUpdateThrottleMs,
      maxSignalHistory: this.config.maxSignalHistory
    };
  }

  // Force immediate save
  forceSave(): void {
    this.saveToStorage();
  }
}
