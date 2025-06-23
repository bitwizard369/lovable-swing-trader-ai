interface CrashReport {
  timestamp: number;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  userAgent: string;
  url: string;
  memoryUsage?: any;
  performanceMetrics?: any;
}

interface PerformanceMetrics {
  memoryUsed: number;
  renderCount: number;
  wsUpdates: number;
  lastUpdateTime: number;
  avgUpdateInterval: number;
}

export class CrashMonitoringService {
  private static instance: CrashMonitoringService;
  private crashReports: CrashReport[] = [];
  private performanceMetrics: PerformanceMetrics = {
    memoryUsed: 0,
    renderCount: 0,
    wsUpdates: 0,
    lastUpdateTime: Date.now(),
    avgUpdateInterval: 0
  };
  private errorCount = 0;
  private maxErrors = 10; // Crash threshold
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeErrorHandling();
    this.startPerformanceMonitoring();
    this.setupBrowserCacheDetection();
  }

  static getInstance(): CrashMonitoringService {
    if (!CrashMonitoringService.instance) {
      CrashMonitoringService.instance = new CrashMonitoringService();
    }
    return CrashMonitoringService.instance;
  }

  private initializeErrorHandling(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.reportCrash({
        timestamp: Date.now(),
        errorType: 'JavaScript Error',
        errorMessage: event.message,
        stackTrace: event.error?.stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        memoryUsage: this.getMemoryUsage(),
        performanceMetrics: this.performanceMetrics
      });
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.reportCrash({
        timestamp: Date.now(),
        errorType: 'Unhandled Promise Rejection',
        errorMessage: event.reason?.message || String(event.reason),
        stackTrace: event.reason?.stack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        memoryUsage: this.getMemoryUsage(),
        performanceMetrics: this.performanceMetrics
      });
    });

    // React error boundary fallback
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      
      // Detect React errors
      if (errorMessage.includes('React') || errorMessage.includes('componentDidCatch')) {
        this.reportCrash({
          timestamp: Date.now(),
          errorType: 'React Error',
          errorMessage,
          userAgent: navigator.userAgent,
          url: window.location.href,
          memoryUsage: this.getMemoryUsage(),
          performanceMetrics: this.performanceMetrics
        });
      }
      
      originalConsoleError.apply(console, args);
    };
  }

  private setupBrowserCacheDetection(): void {
    // Check for stale cache issues
    const buildVersion = '1.0.0'; // Should be dynamic in real app
    const lastBuildVersion = localStorage.getItem('lastBuildVersion');
    
    if (lastBuildVersion && lastBuildVersion !== buildVersion) {
      console.warn('🚨 Build version changed - clearing caches to prevent issues');
      this.clearBrowserCaches();
    }
    
    localStorage.setItem('lastBuildVersion', buildVersion);

    // Detect service worker cache issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        console.log('🔄 Service worker ready - checking for updates');
        return navigator.serviceWorker.getRegistrations();
      }).then(registrations => {
        registrations.forEach(registration => {
          registration.update();
        });
      }).catch(error => {
        console.error('❌ Service worker error:', error);
      });
    }
  }

  private clearBrowserCaches(): void {
    try {
      // Clear localStorage (except important data)
      const importantKeys = ['realAccountData', 'userPreferences'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (!importantKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear sessionStorage
      sessionStorage.clear();

      // Force reload to clear memory caches
      if (this.errorCount > 5) {
        console.warn('🔄 High error count - forcing cache refresh');
        window.location.reload();
      }

    } catch (error) {
      console.error('❌ Failed to clear browser caches:', error);
    }
  }

  private getMemoryUsage(): any {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  private startPerformanceMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      // Update performance metrics
      this.performanceMetrics.memoryUsed = this.getMemoryUsage()?.usedJSHeapSize || 0;
      
      // Check for memory leaks
      if (this.performanceMetrics.memoryUsed > 100 * 1024 * 1024) { // 100MB threshold
        console.warn('⚠️ High memory usage detected:', this.performanceMetrics.memoryUsed / (1024 * 1024), 'MB');
        this.reportCrash({
          timestamp: Date.now(),
          errorType: 'Memory Leak Warning',
          errorMessage: `High memory usage: ${this.performanceMetrics.memoryUsed / (1024 * 1024)}MB`,
          userAgent: navigator.userAgent,
          url: window.location.href,
          memoryUsage: this.getMemoryUsage(),
          performanceMetrics: this.performanceMetrics
        });
      }

      // Check for render loops
      if (this.performanceMetrics.renderCount > 1000) {
        console.warn('⚠️ Excessive render count detected:', this.performanceMetrics.renderCount);
        this.performanceMetrics.renderCount = 0; // Reset to prevent spam
      }

    }, 10000); // Every 10 seconds
  }

  public reportCrash(report: CrashReport): void {
    this.errorCount++;
    this.crashReports.push(report);
    
    // Keep only last 50 reports to prevent memory bloat
    if (this.crashReports.length > 50) {
      this.crashReports = this.crashReports.slice(-50);
    }

    console.error('🚨 CRASH REPORT:', report);

    // Emergency measures if too many errors
    if (this.errorCount >= this.maxErrors) {
      console.error('🚨 CRITICAL: Too many errors detected - initiating emergency recovery');
      this.emergencyRecovery();
    }

    // Store crash report for analysis
    try {
      const storedReports = JSON.parse(localStorage.getItem('crashReports') || '[]');
      storedReports.push(report);
      localStorage.setItem('crashReports', JSON.stringify(storedReports.slice(-20))); // Keep last 20
    } catch (error) {
      console.error('❌ Failed to store crash report:', error);
    }
  }

  private emergencyRecovery(): void {
    console.log('🚑 Initiating emergency recovery...');
    
    // Clear all caches
    this.clearBrowserCaches();
    
    // Reset error count
    this.errorCount = 0;
    
    // Notify user
    alert('The application has detected multiple errors and will refresh to recover. Your data has been preserved.');
    
    // Force reload
    window.location.reload();
  }

  public updatePerformanceMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
  }

  public getCrashReports(): CrashReport[] {
    return [...this.crashReports];
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  public resetErrorCount(): void {
    this.errorCount = 0;
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Initialize crash monitoring
export const crashMonitor = CrashMonitoringService.getInstance();
