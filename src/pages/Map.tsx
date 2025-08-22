
import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { GoogleMap } from "@/components/ui/google-map";
import BottomNavigation from "@/components/layout/BottomNavigation";
import { DriverBottomNavigation } from "@/components/layout/DriverBottomNavigation";
import TopPanel from "@/components/layout/TopPanel";
import { LocationCoords } from "@/services/googleMaps";

const MapPage: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [origin, setOrigin] = useState<LocationCoords | null>(null);
  const [destination, setDestination] = useState<LocationCoords | null>(null);

  // Redirect logic for unauthenticated users
  useEffect(() => {
    if (!loading && !user) {
      console.log('User not authenticated, redirecting to /auth');
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Get user's current location after authentication
  useEffect(() => {
    if (user && navigator.geolocation) {
      console.log('Buscando localização do usuário...');
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          console.log('Localização encontrada:', userLocation);
          setCurrentLocation(userLocation);
        },
        (error) => {
          console.error("Erro ao obter localização:", error);
          
          // Fallback para localização padrão (São Paulo)
          const fallbackLocation = { lat: -23.5505, lng: -46.6333 };
          console.log('Usando localização padrão:', fallbackLocation);
          setCurrentLocation(fallbackLocation);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutos
        }
      );
    }
  }, [user]);

  useEffect(() => {
    // SEO basics
    document.title = "Mapa | RideBuddy";

    // Meta description
    const ensureMeta = () => {
      let m = document.querySelector('meta[name="description"]');
      if (!m) {
        m = document.createElement("meta");
        m.setAttribute("name", "description");
        document.head.appendChild(m);
      }
      return m as HTMLMetaElement;
    };
    ensureMeta().setAttribute(
      "content",
      "Mapa em tela cheia com navegação inferior no RideBuddy."
    );

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = `${window.location.origin}/map`;
  }, []);

  // Show loading while authentication is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show loading if user exists but profile is still loading
  if (user && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // If no user, the useEffect will handle redirect to /auth
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background">
      {/* Painel superior com solicitar corrida */}
      <TopPanel
        currentLocation={currentLocation}
        onOriginUpdate={setOrigin}
        onDestinationUpdate={setDestination}
      />

      {/* Mapa em tela inteira */}
      <GoogleMap 
        className="w-full h-full" 
        origin={origin || currentLocation}
        destination={destination}
      />

      {/* Navegação inferior fixa */}
      {profile?.user_type === 'driver' ? (
        <DriverBottomNavigation />
      ) : (
        <BottomNavigation />
      )}
    </div>
  );
};

export default MapPage;
