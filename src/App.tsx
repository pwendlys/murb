
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
            <Route path="/admin" element={<Admin />} />
            
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

export default App;
