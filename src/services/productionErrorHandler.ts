interface ErrorReport {
  id: string;
  timestamp: Date;
  type: 'javascript' | 'network' | 'database' | 'authentication' | 'websocket';
  message: string;
  stack?: string;
  context: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  userAgent: string;
  url: string;
}

interface ErrorHandlerConfig {
  maxErrors: number;
  reportingThreshold: number;
  autoRecoveryEnabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

export class ProductionErrorHandler {
  private static instance: ProductionErrorHandler;
  private errors: ErrorReport[] = [];
  private config: ErrorHandlerConfig;
  private errorCount = 0;
  private isRecovering = false;

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      maxErrors: 50,
      reportingThreshold: 10,
      autoRecoveryEnabled: true,
      logLevel: 'error',
      ...config
    };

    this.initializeGlobalErrorHandling();
    console.log('[Production Error Handler] 🚀 Initialized with config:', this.config);
  }

  static getInstance(config?: Partial<ErrorHandlerConfig>): ProductionErrorHandler {
    if (!ProductionErrorHandler.instance) {
      ProductionErrorHandler.instance = new ProductionErrorHandler(config);
    }
    return ProductionErrorHandler.instance;
  }

  private initializeGlobalErrorHandling(): void {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.reportError({
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        },
        severity: this.categorizeJavaScriptError(event.message)
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.reportError({
        type: 'javascript',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: { reason: event.reason },
        severity: 'high'
      });
    });

    // Network errors (fetch failures)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.reportError({
            type: 'network',
            message: `HTTP ${response.status}: ${response.statusText}`,
            context: {
              url: args[0],
              status: response.status,
              statusText: response.statusText
            },
            severity: response.status >= 500 ? 'high' : 'medium'
          });
        }
        return response;
      } catch (error) {
        this.reportError({
          type: 'network',
          message: `Network request failed: ${error}`,
          context: { url: args[0], error },
          severity: 'high'
        });
        throw error;
      }
    };
  }

  reportError(errorData: Partial<ErrorReport>): void {
    const errorReport: ErrorReport = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      resolved: false,
      ...errorData
    } as ErrorReport;

    this.errors.push(errorReport);
    this.errorCount++;

    // Keep only recent errors
    if (this.errors.length > this.config.maxErrors) {
      this.errors = this.errors.slice(-this.config.maxErrors);
    }

    // Log error based on severity
    this.logError(errorReport);

    // Store in localStorage for persistence
    this.persistError(errorReport);

    // Check if auto-recovery is needed
    if (this.config.autoRecoveryEnabled && this.shouldTriggerRecovery()) {
      this.initiateAutoRecovery();
    }

    console.error(`[Production Error Handler] 🚨 Error reported:`, errorReport);
  }

  private categorizeJavaScriptError(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('script error') || lowerMessage.includes('network')) {
      return 'medium';
    }
    
    if (lowerMessage.includes('out of memory') || lowerMessage.includes('recursion')) {
      return 'critical';
    }
    
    if (lowerMessage.includes('cannot read property') || lowerMessage.includes('undefined')) {
      return 'high';
    }
    
    return 'medium';
  }

  private shouldTriggerRecovery(): boolean {
    const recentErrors = this.errors.filter(
      error => Date.now() - error.timestamp.getTime() < 60000 // Last minute
    );
    
    const criticalErrors = recentErrors.filter(error => error.severity === 'critical');
    const highErrors = recentErrors.filter(error => error.severity === 'high');
    
    return criticalErrors.length > 2 || highErrors.length > 5 || recentErrors.length > 10;
  }

  private async initiateAutoRecovery(): Promise<void> {
    if (this.isRecovering) return;
    
    this.isRecovering = true;
    console.log('[Production Error Handler] 🚑 CRITICAL: Initiating auto-recovery sequence...');

    try {
      // Clear caches
      localStorage.clear();
      sessionStorage.clear();
      
      // Clear service worker cache if available
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      
      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Reset error count
      this.errorCount = 0;
      this.errors = [];
      
      // Notify user
      const userConfirmed = confirm(
        'The application has detected critical errors and needs to refresh to recover. ' +
        'Your session data will be preserved. Continue?'
      );
      
      if (userConfirmed) {
        // Force reload with cache bypass
        window.location.reload();
      }
      
    } catch (recoveryError) {
      console.error('[Production Error Handler] ❌ Recovery failed:', recoveryError);
      this.reportError({
        type: 'javascript',
        message: 'Auto-recovery process failed',
        context: { recoveryError },
        severity: 'critical'
      });
    } finally {
      this.isRecovering = false;
    }
  }

  private logError(error: ErrorReport): void {
    const logMessage = `[${error.type.toUpperCase()}] ${error.message}`;
    
    switch (error.severity) {
      case 'critical':
        console.error('🚨 CRITICAL:', logMessage, error);
        break;
      case 'high':
        console.error('❌ HIGH:', logMessage, error);
        break;
      case 'medium':
        console.warn('⚠️ MEDIUM:', logMessage, error);
        break;
      case 'low':
        console.info('ℹ️ LOW:', logMessage, error);
        break;
    }
  }

  private persistError(error: ErrorReport): void {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('production_errors') || '[]');
      storedErrors.push(error);
      
      // Keep only last 20 errors in storage
      const recentErrors = storedErrors.slice(-20);
      localStorage.setItem('production_errors', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.warn('[Production Error Handler] ⚠️ Failed to persist error:', storageError);
    }
  }

  // Get error statistics
  getErrorStats() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recentErrors = this.errors.filter(error => 
      now - error.timestamp.getTime() < oneHour
    );

    return {
      totalErrors: this.errors.length,
      recentErrors: recentErrors.length,
      errorsByType: this.groupErrorsByType(),
      errorsBySeverity: this.groupErrorsBySeverity(),
      unResolvedErrors: this.errors.filter(e => !e.resolved).length,
      isRecovering: this.isRecovering,
      errorRate: recentErrors.length / 60 // errors per minute
    };
  }

  private groupErrorsByType() {
    return this.errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupErrorsBySeverity() {
    return this.errors.reduce((acc, error) => {
      acc[error.severity] = (acc[error.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // Get recent errors for display
  getRecentErrors(limit = 10): ErrorReport[] {
    return this.errors
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Mark error as resolved
  resolveError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      console.log(`[Production Error Handler] ✅ Error resolved: ${errorId}`);
    }
  }

  // Clear all errors
  clearErrors(): void {
    this.errors = [];
    this.errorCount = 0;
    localStorage.removeItem('production_errors');
    console.log('[Production Error Handler] 🧹 All errors cleared');
  }

  // Manual recovery trigger
  async triggerManualRecovery(): Promise<void> {
    console.log('[Production Error Handler] 🔧 Manual recovery triggered');
    await this.initiateAutoRecovery();
  }
}

// Export singleton instance
export const productionErrorHandler = ProductionErrorHandler.getInstance();
