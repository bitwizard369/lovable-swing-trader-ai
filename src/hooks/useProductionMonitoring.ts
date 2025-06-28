
import { useState, useEffect, useCallback } from 'react';
import { productionCache } from '@/services/productionCacheService';
import { productionErrorHandler } from '@/services/productionErrorHandler';
import { crashMonitor } from '@/services/crashMonitoringService';

interface ProductionMetrics {
  systemHealth: boolean;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  performanceScore: number;
  uptime: number;
  lastCheck: Date;
}

interface MonitoringConfig {
  checkInterval: number;
  alertThresholds: {
    errorRate: number;
    memoryUsage: number;
    performanceScore: number;
  };
  autoRecovery: boolean;
}

export const useProductionMonitoring = (config: Partial<MonitoringConfig> = {}) => {
  const [metrics, setMetrics] = useState<ProductionMetrics>({
    systemHealth: true,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    performanceScore: 100,
    uptime: 0,
    lastCheck: new Date()
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  const monitoringConfig: MonitoringConfig = {
    checkInterval: 30000, // 30 seconds
    alertThresholds: {
      errorRate: 5, // 5 errors per minute
      memoryUsage: 85, // 85% memory usage
      performanceScore: 70 // Below 70% performance
    },
    autoRecovery: true,
    ...config
  };

  const collectMetrics = useCallback(async (): Promise<ProductionMetrics> => {
    try {
      console.log('[Production Monitoring] 📊 Collecting comprehensive metrics...');

      // Error metrics
      const errorStats = productionErrorHandler.getErrorStats();
      const errorRate = errorStats.errorRate;

      // Cache metrics
      const cacheStats = productionCache.getStats();
      const cacheHitRate = cacheStats.size > 0 ? 
        (cacheStats.entries.reduce((sum, entry) => sum + entry.hits, 0) / cacheStats.size) * 10 : 100;

      // Memory metrics
      const memoryInfo = (performance as any).memory;
      const memoryUsage = memoryInfo ? 
        (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100 : 0;

      // Performance metrics
      const performanceMetrics = crashMonitor.getPerformanceMetrics();
      const performanceScore = Math.max(0, 100 - (errorRate * 10) - (memoryUsage * 0.5));

      // System uptime
      const uptime = Date.now() - (new Date().getTime() - 24 * 60 * 60 * 1000);

      // Overall health assessment
      const systemHealth = 
        errorRate < monitoringConfig.alertThresholds.errorRate &&
        memoryUsage < monitoringConfig.alertThresholds.memoryUsage &&
        performanceScore > monitoringConfig.alertThresholds.performanceScore;

      const newMetrics: ProductionMetrics = {
        systemHealth,
        errorRate,
        cacheHitRate,
        memoryUsage,
        performanceScore,
        uptime,
        lastCheck: new Date()
      };

      return newMetrics;
    } catch (error) {
      console.error('[Production Monitoring] ❌ Failed to collect metrics:', error);
      productionErrorHandler.reportError({
        type: 'javascript',
        message: 'Failed to collect production metrics',
        context: { error },
        severity: 'medium'
      });

      return metrics; // Return current metrics on error
    }
  }, [metrics, monitoringConfig]);

  const checkAlerts = useCallback((newMetrics: ProductionMetrics) => {
    const newAlerts: string[] = [];

    if (newMetrics.errorRate > monitoringConfig.alertThresholds.errorRate) {
      newAlerts.push(`High error rate: ${newMetrics.errorRate.toFixed(2)} errors/min`);
    }

    if (newMetrics.memoryUsage > monitoringConfig.alertThresholds.memoryUsage) {
      newAlerts.push(`High memory usage: ${newMetrics.memoryUsage.toFixed(1)}%`);
    }

    if (newMetrics.performanceScore < monitoringConfig.alertThresholds.performanceScore) {
      newAlerts.push(`Low performance score: ${newMetrics.performanceScore.toFixed(1)}%`);
    }

    if (!newMetrics.systemHealth) {
      newAlerts.push('System health degraded - multiple thresholds exceeded');
    }

    setAlerts(newAlerts);

    // Trigger auto-recovery if enabled and system is unhealthy
    if (monitoringConfig.autoRecovery && !newMetrics.systemHealth && newAlerts.length > 2) {
      console.log('[Production Monitoring] 🚑 CRITICAL: Triggering auto-recovery due to system degradation');
      productionErrorHandler.triggerManualRecovery();
    }

    return newAlerts;
  }, [monitoringConfig]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    console.log('[Production Monitoring] 🚀 Starting production monitoring system...');
    setIsMonitoring(true);

    const monitoringLoop = async () => {
      try {
        const newMetrics = await collectMetrics();
        setMetrics(newMetrics);
        
        const newAlerts = checkAlerts(newMetrics);
        
        console.log('[Production Monitoring] 📊 Metrics updated:', {
          health: newMetrics.systemHealth,
          errorRate: newMetrics.errorRate,
          memoryUsage: `${newMetrics.memoryUsage.toFixed(1)}%`,
          performance: `${newMetrics.performanceScore.toFixed(1)}%`,
          alerts: newAlerts.length
        });

      } catch (error) {
        console.error('[Production Monitoring] ❌ Monitoring loop error:', error);
      }
    };

    // Initial collection
    monitoringLoop();

    // Set up interval
    const interval = setInterval(monitoringLoop, monitoringConfig.checkInterval);

    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
      console.log('[Production Monitoring] 🛑 Monitoring stopped');
    };
  }, [isMonitoring, collectMetrics, checkAlerts, monitoringConfig.checkInterval]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    console.log('[Production Monitoring] 🛑 Production monitoring stopped');
  }, []);

  const resetMetrics = useCallback(() => {
    setMetrics({
      systemHealth: true,
      errorRate: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      performanceScore: 100,
      uptime: 0,
      lastCheck: new Date()
    });
    setAlerts([]);
    productionErrorHandler.clearErrors();
    productionCache.clear();
    console.log('[Production Monitoring] 🔄 Metrics reset');
  }, []);

  const getSystemReport = useCallback(() => {
    const errorStats = productionErrorHandler.getErrorStats();
    const cacheStats = productionCache.getStats();
    const performanceMetrics = crashMonitor.getPerformanceMetrics();

    return {
      timestamp: new Date(),
      systemHealth: metrics.systemHealth,
      metrics: metrics,
      alerts: alerts,
      errorDetails: errorStats,
      cacheDetails: cacheStats,
      performanceDetails: performanceMetrics,
      recommendations: generateRecommendations(metrics, alerts)
    };
  }, [metrics, alerts]);

  const generateRecommendations = (metrics: ProductionMetrics, alerts: string[]): string[] => {
    const recommendations: string[] = [];

    if (metrics.errorRate > 2) {
      recommendations.push('Consider implementing more robust error boundaries');
    }

    if (metrics.memoryUsage > 70) {
      recommendations.push('Review memory usage and implement cleanup routines');
    }

    if (metrics.cacheHitRate < 50) {
      recommendations.push('Optimize caching strategy for better performance');
    }

    if (metrics.performanceScore < 80) {
      recommendations.push('Profile and optimize slow components');
    }

    if (alerts.length > 3) {
      recommendations.push('Consider scaling infrastructure or optimizing code');
    }

    return recommendations;
  };

  // Auto-start monitoring on mount
  useEffect(() => {
    const cleanup = startMonitoring();
    return cleanup;
  }, [startMonitoring]);

  return {
    metrics,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    resetMetrics,
    getSystemReport,
    collectMetrics
  };
};
