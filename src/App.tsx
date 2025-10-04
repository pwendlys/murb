
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { queryClient } from "@/lib/cache";
import { logTelemetry } from "@/lib/telemetry";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import SimpleAdminLogin from "./pages/SimpleAdminLogin";
import Map from "./pages/Map";
import Rides from "./pages/Rides";
import DriverOnboardingGate from "./components/driver/DriverOnboardingGate";
import { DriverMapPage } from "./pages/driver/DriverMapPage";
import { DriverRidesPage } from "./pages/driver/DriverRidesPage";
import { DriverEarningsPage } from "./pages/driver/DriverEarningsPage";
import { DriverReviewsPage } from "./pages/driver/DriverReviewsPage";
import { PassengerReviewsPage } from "./pages/passenger/PassengerReviewsPage";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import { PWAHandler } from "./components/pwa/PWAHandler";

const App = () => {
  const adminSecretPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
  
  // Service Worker telemetry listener
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.VITE_ENABLE_SERVICE_WORKER === 'true') {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CACHE_HIT') {
          logTelemetry({ 
            event: 'response_cache_hit', 
            data: { url: event.data.url } 
          });
        }
      });

      // Log SW installation and activation
      navigator.serviceWorker.ready.then(() => {
        logTelemetry({ 
          event: 'sw_activated', 
          data: { timestamp: new Date().toISOString() } 
        });
      });

      navigator.serviceWorker.register('/sw.js').then(() => {
        logTelemetry({ 
          event: 'sw_installed', 
          data: { timestamp: new Date().toISOString() } 
        });
      }).catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
    }
  }, []);
  
  return (
  <QueryClientProvider client={queryClient}>
    <ReactQueryDevtools initialIsOpen={false} />
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/map" element={<Map />} />
            <Route path="/rides" element={<Rides />} />
            
            {/* Admin Secret Routes */}
            <Route path={adminSecretPath} element={<AdminLogin />} />
            <Route path={`${adminSecretPath}/painel`} element={<Admin />} />
            
            {/* Simple Admin Login Route */}
            <Route path="/admin-login-direto" element={<SimpleAdminLogin />} />
            
            {/* Driver Routes */}
            <Route path="/driver/map" element={<DriverMapPage />} />
            <Route path="/driver/rides" element={<DriverRidesPage />} />
            <Route path="/driver/earnings" element={<DriverEarningsPage />} />
            <Route path="/driver/reviews" element={<DriverReviewsPage />} />
            <Route path="/reviews" element={<PassengerReviewsPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>

        {/* Gate global para fluxo de mototaxista (não altera rotas/UX existentes) */}
        <DriverOnboardingGate />
        
        {/* PWA Components */}
        <InstallPrompt />
        <PWAHandler />
      </AuthProvider>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
};

export default App;
