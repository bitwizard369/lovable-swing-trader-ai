
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, AuthModal } from "@/components/AuthProvider";
import { useProductionMonitoring } from "@/hooks/useProductionMonitoring";
import { productionErrorHandler } from "@/services/productionErrorHandler";
import { productionCache } from "@/services/productionCacheService";
import Index from "@/pages/Index";
import ProductionDashboard from "@/pages/ProductionDashboard";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();
  
  // Initialize production monitoring
  const monitoring = useProductionMonitoring({
    checkInterval: 30000, // 30 seconds
    alertThresholds: {
      errorRate: 5,
      memoryUsage: 85,
      performanceScore: 70
    },
    autoRecovery: true
  });

  useEffect(() => {
    console.log('[App] 🚀 PRODUCTION MODE: Initializing comprehensive systems...');
    
    // Log system initialization
    productionErrorHandler.reportError({
      type: 'javascript',
      message: 'Application initialized in production mode',
      severity: 'low',
      context: {
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    });

    // Initialize cache warming
    productionCache.set('app_initialized', true, 24 * 60 * 60 * 1000); // 24 hours

    // Start monitoring
    monitoring.startMonitoring();

    console.log('[App] ✅ PRODUCTION: All systems operational');

    return () => {
      monitoring.stopMonitoring();
      productionCache.destroy();
    };
  }, []);

  // Show production system status if unhealthy
  useEffect(() => {
    if (!monitoring.metrics.systemHealth && monitoring.alerts.length > 0) {
      console.warn('[App] ⚠️ PRODUCTION ALERT: System health degraded', monitoring.alerts);
    }
  }, [monitoring.metrics.systemHealth, monitoring.alerts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg mb-2">Loading Production System...</div>
          <div className="text-blue-300 text-sm">Initializing security & monitoring</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<ProductionDashboard />} />
          <Route path="/simple" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      {!user && <AuthModal />}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
