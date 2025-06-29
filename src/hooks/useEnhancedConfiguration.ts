
import { useState, useEffect } from 'react';
import { EnhancedConfigurationService } from '@/services/enhancedConfigurationService';

interface TradingConfiguration {
  maxPositionSize: number;
  positionSizePercentage: number;
  maxOpenPositions: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxDailyLoss: number;
  riskPerTrade: number;
  minProbability: number;
  minConfidence: number;
  useKellyCriterion: boolean;
  adaptiveEntryThreshold: boolean;
  atrBasedTrailingStop: boolean;
  initialBalance: number;
  wsReconnectAttempts: number;
  wsMessageThrottleMs: number;
  wsHeartbeatIntervalMs: number;
  orderBookDepthLimit: number;
  priceUpdateThrottleMs: number;
  maxSignalHistory: number;
  theme: 'light' | 'dark' | 'auto';
  defaultSymbol: string;
  autoConnect: boolean;
  showAdvancedMetrics: boolean;
}

interface UseEnhancedConfigurationReturn {
  config: TradingConfiguration | null;
  isLoading: boolean;
  validationErrors: string[];
  updateConfiguration: (updates: Partial<TradingConfiguration>) => { success: boolean; errors: string[] };
  resetToDefaults: () => { success: boolean; errors: string[] };
  exportConfig: () => string;
  importConfig: (configJson: string) => { success: boolean; errors: string[] };
  getRiskManagementConfig: () => any;
  getWebSocketConfig: () => any;
  getPerformanceConfig: () => any;
  forceSave: () => void;
}

export const useEnhancedConfiguration = (): UseEnhancedConfigurationReturn => {
  const [config, setConfig] = useState<TradingConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    const configService = EnhancedConfigurationService.getInstance();
    
    // Get initial configuration
    const initialConfig = configService.getConfiguration();
    setConfig(initialConfig);
    setIsLoading(false);

    // Subscribe to configuration changes
    const unsubscribeConfig = configService.subscribe((newConfig) => {
      setConfig(newConfig);
      console.log('[useEnhancedConfiguration] 🔄 Configuration updated');
    });

    // Subscribe to validation errors
    const unsubscribeValidation = configService.subscribeToValidation((errors) => {
      setValidationErrors(errors);
      if (errors.length > 0) {
        console.warn('[useEnhancedConfiguration] ⚠️ Validation errors:', errors);
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeValidation();
    };
  }, []);

  const updateConfiguration = (updates: Partial<TradingConfiguration>) => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.updateConfiguration(updates);
  };

  const resetToDefaults = () => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.resetToDefaults();
  };

  const exportConfig = () => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.exportConfiguration();
  };

  const importConfig = (configJson: string) => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.importConfiguration(configJson);
  };

  const getRiskManagementConfig = () => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.getRiskManagementConfig();
  };

  const getWebSocketConfig = () => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.getWebSocketConfig();
  };

  const getPerformanceConfig = () => {
    const configService = EnhancedConfigurationService.getInstance();
    return configService.getPerformanceConfig();
  };

  const forceSave = () => {
    const configService = EnhancedConfigurationService.getInstance();
    configService.forceSave();
  };

  return {
    config,
    isLoading,
    validationErrors,
    updateConfiguration,
    resetToDefaults,
    exportConfig,
    importConfig,
    getRiskManagementConfig,
    getWebSocketConfig,
    getPerformanceConfig,
    forceSave
  };
};
