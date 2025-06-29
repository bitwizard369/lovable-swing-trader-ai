
import { useState, useEffect } from 'react';
import { ConfigurationService } from '@/services/configurationService';

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
}

export const useConfiguration = () => {
  const [config, setConfig] = useState<TradingConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const configService = ConfigurationService.getInstance();
    
    // Get initial configuration
    const initialConfig = configService.getConfiguration();
    setConfig(initialConfig);
    setIsLoading(false);

    // Subscribe to configuration changes
    const unsubscribe = configService.subscribe((newConfig) => {
      setConfig(newConfig);
      console.log('[useConfiguration] 🔄 Configuration updated:', newConfig);
    });

    return unsubscribe;
  }, []);

  const updateConfiguration = (updates: Partial<TradingConfiguration>) => {
    const configService = ConfigurationService.getInstance();
    configService.updateConfiguration(updates);
  };

  const resetToDefaults = () => {
    const configService = ConfigurationService.getInstance();
    configService.resetToDefaults();
  };

  const exportConfig = () => {
    const configService = ConfigurationService.getInstance();
    return configService.exportConfiguration();
  };

  const importConfig = (configJson: string) => {
    const configService = ConfigurationService.getInstance();
    return configService.importConfiguration(configJson);
  };

  return {
    config,
    isLoading,
    updateConfiguration,
    resetToDefaults,
    exportConfig,
    importConfig
  };
};
