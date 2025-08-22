import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { LocationCoords } from '@/services/googleMaps';
import { LoadingSpinner } from './loading-spinner';
import { supabase } from '@/integrations/supabase/client';

interface DriverMarker {
  position: LocationCoords;
  heading?: number;
}

interface GoogleMapProps {
  origin?: LocationCoords;
  destination?: LocationCoords;
  driverMarker?: DriverMarker;
  className?: string;
  driverIconUrl?: string;
  showDriverToOriginRoute?: boolean;
  driverRouteTarget?: LocationCoords | null;
}

declare global {
  interface Window {
    google: any;
    initGoogleMaps: () => void;
  }
}

export const GoogleMap = ({ origin, destination, driverMarker, className = "w-full h-96", driverIconUrl = "/lovable-uploads/c92f560c-e511-488d-81c8-9ba12ee95c28.png", showDriverToOriginRoute = false, driverRouteTarget }: GoogleMapProps) => {
  const { theme, systemTheme } = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const driverDirectionsRendererRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Get the current theme to apply to the map
  const getMapColorScheme = () => {
    const currentTheme = theme === 'system' ? systemTheme : theme;
    return currentTheme === 'dark' ? 'DARK' : 'LIGHT';
  };

  // Build driver marker content with the motorcycle image
  const buildDriverMarkerContent = (heading: number = 0) => {
    const markerDiv = document.createElement('div');
    markerDiv.className = 'relative flex items-center justify-center';
    markerDiv.style.cssText = `
      width: 32px;
      height: 32px;
      transform: rotate(${heading}deg);
      z-index: 1000;
    `;

    const imgElement = document.createElement('img');
    imgElement.src = driverIconUrl;
    imgElement.alt = 'Mototaxista';
    imgElement.style.cssText = `
      width: 32px;
      height: 32px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;

    // Fallback in case image doesn't load
    imgElement.onerror = () => {
      markerDiv.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          background: #2563eb;
          border-radius: 50%;
        "></div>
      `;
    };

    markerDiv.appendChild(imgElement);
    return markerDiv;
  };

  const initializeMap = async () => {
    if (!mapRef.current || !window.google || mapInitialized) return;

    try {
      console.log('Inicializando mapa Google Maps...');
      
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: origin || driverMarker?.position || { lat: -23.5505, lng: -46.6333 }, // Default to São Paulo
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        colorScheme: getMapColorScheme(),
        mapId: 'driver-tracking-map', // Required for AdvancedMarkerElement
      });

      mapInstanceRef.current = map;
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      
      // Main route renderer (A to B)
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 4,
        }
      });
      directionsRendererRef.current.setMap(map);

      // Driver to origin route renderer (green line)
      driverDirectionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true, // Don't show default markers for this route
        polylineOptions: {
          strokeColor: '#22c55e', // Green color
          strokeWeight: 3,
          strokeOpacity: 0.8,
        }
      });
      driverDirectionsRendererRef.current.setMap(map);

      setMapInitialized(true);
      setIsLoading(false);
      console.log('Mapa inicializado com sucesso!');
    } catch (err) {
      console.error('Erro ao inicializar mapa:', err);
      setError('Erro ao carregar o mapa. Verifique a chave API do Google Maps.');
      setIsLoading(false);
    }
  };

  const updateMarkersAndRoute = () => {
    if (!mapInstanceRef.current || !window.google || !mapInitialized) return;

    // Clear existing markers
    if (originMarkerRef.current) {
      originMarkerRef.current.setMap(null);
      originMarkerRef.current = null;
    }
    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.setMap(null);
      destinationMarkerRef.current = null;
    }
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

    // Clear existing routes
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
    if (driverDirectionsRendererRef.current) {
      driverDirectionsRendererRef.current.setDirections({ routes: [] });
    }

    // Determine bounds for fit
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    // Add driver marker with motorcycle image using AdvancedMarkerElement
    if (driverMarker && window.google.maps.marker?.AdvancedMarkerElement) {
      try {
        driverMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: driverMarker.position,
          map: mapInstanceRef.current,
          title: 'Mototaxista',
          content: buildDriverMarkerContent(driverMarker.heading || 0),
          zIndex: 1000,
        });
      } catch (err) {
        console.warn('AdvancedMarkerElement failed, using fallback:', err);
        // Fallback to regular marker with motorcycle image
        driverMarkerRef.current = new window.google.maps.Marker({
          position: driverMarker.position,
          map: mapInstanceRef.current,
          title: 'Mototaxista',
          icon: {
            url: driverIconUrl,
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 16),
            rotation: driverMarker.heading || 0,
          },
          zIndex: 1000,
        });
      }
      bounds.extend(driverMarker.position);
      hasPoints = true;
    } else if (driverMarker) {
      // Fallback to regular marker with motorcycle image
      driverMarkerRef.current = new window.google.maps.Marker({
        position: driverMarker.position,
        map: mapInstanceRef.current,
        title: 'Mototaxista',
        icon: {
          url: driverIconUrl,
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16),
          rotation: driverMarker.heading || 0,
        },
        zIndex: 1000,
      });
      bounds.extend(driverMarker.position);
      hasPoints = true;
    }

    // Add origin marker
    if (origin) {
      originMarkerRef.current = new window.google.maps.Marker({
        position: origin,
        map: mapInstanceRef.current,
        title: 'Origem',
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(30, 30),
        }
      });
      bounds.extend(origin);
      hasPoints = true;
    }

    // Add destination marker
    if (destination) {
      destinationMarkerRef.current = new window.google.maps.Marker({
        position: destination,
        map: mapInstanceRef.current,
        title: 'Destino',
        icon: {
          url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(30, 30),
        }
      });
      bounds.extend(destination);
      hasPoints = true;
    }

    // Calculate and display main route (origin to destination) if both are available
    if (origin && destination && directionsServiceRef.current && directionsRendererRef.current) {
      directionsServiceRef.current.route(
        {
          origin: origin,
          destination: destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === 'OK') {
            directionsRendererRef.current.setDirections(result);
          } else {
            console.error('Main route request failed due to ' + status);
          }
        }
      );
    }

    // Calculate and display driver to target route (green line) using driverRouteTarget
    if (showDriverToOriginRoute && driverMarker && driverRouteTarget && directionsServiceRef.current && driverDirectionsRendererRef.current) {
      directionsServiceRef.current.route(
        {
          origin: driverMarker.position,
          destination: driverRouteTarget,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === 'OK') {
            driverDirectionsRendererRef.current.setDirections(result);
          } else {
            console.error('Driver to target route request failed due to ' + status);
          }
        }
      );
    }

    // Fit bounds if we have points
    if (hasPoints) {
      mapInstanceRef.current.fitBounds(bounds, {
        padding: { top: 50, right: 50, bottom: 50, left: 50 }
      });
    } else if (origin || destination || driverMarker) {
      // If only one location is available, center the map on it
      const center = origin || destination || driverMarker?.position;
      mapInstanceRef.current.setCenter(center);
    }
  };

  const loadGoogleMapsScript = async (retryCount = 0) => {
    const maxRetries = 3;
    
    if (window.google) {
      console.log('Google Maps já carregado, inicializando...');
      initializeMap();
      return;
    }

    try {
      console.log(`Tentativa ${retryCount + 1}/${maxRetries + 1} - Carregando chave API do Google Maps...`);
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      
      if (error) {
        console.error('Erro ao buscar chave API:', error);
        throw new Error(`Erro ao buscar chave API: ${error.message}`);
      }

      if (!data || !data.key) {
        console.error('Resposta da API:', data);
        throw new Error('Chave API não retornada pelo servidor');
      }

      console.log('Chave API obtida, carregando script do Google Maps...');

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=geometry,places,marker&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;
      
      // Create a global callback for when the script loads
      window.initGoogleMaps = () => {
        console.log('Script do Google Maps carregado com sucesso');
        initializeMap();
      };
      
      script.onerror = (err) => {
        console.error('Falha ao carregar script do Google Maps:', err);
        
        if (retryCount < maxRetries) {
          console.log(`Tentando novamente em 2 segundos... (tentativa ${retryCount + 2})`);
          setTimeout(() => {
            loadGoogleMapsScript(retryCount + 1);
          }, 2000);
        } else {
          setError('Falha ao carregar o Google Maps. Verifique sua conexão com a internet e a validade da chave API.');
          setIsLoading(false);
        }
      };
      
      document.head.appendChild(script);
    } catch (err: any) {
      console.error('Erro no carregamento do Google Maps:', err);
      
      if (retryCount < maxRetries) {
        console.log(`Tentando novamente em 2 segundos... (tentativa ${retryCount + 2})`);
        setTimeout(() => {
          loadGoogleMapsScript(retryCount + 1);
        }, 2000);
      } else {
        setError(`Erro ao carregar o Google Maps: ${err.message}`);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (mapInitialized) {
      updateMarkersAndRoute();
    }
  }, [origin, destination, driverMarker, mapInitialized, driverIconUrl, showDriverToOriginRoute, driverRouteTarget]);

  // Update map color scheme when theme changes
  useEffect(() => {
    if (mapInstanceRef.current && mapInitialized && window.google) {
      try {
        mapInstanceRef.current.set('colorScheme', getMapColorScheme());
      } catch (err) {
        console.warn('Failed to update map color scheme:', err);
      }
    }
  }, [theme, systemTheme, mapInitialized]);

  if (error) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-muted rounded-lg p-4`}>
        <p className="text-destructive text-center mb-2 font-medium">Erro no Google Maps</p>
        <p className="text-muted-foreground text-sm text-center">{error}</p>
        <button 
          onClick={() => {
            setError(null);
            setIsLoading(true);
            loadGoogleMapsScript(0);
          }} 
          className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className} rounded-lg overflow-hidden border`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-2 text-sm text-muted-foreground">Carregando mapa...</p>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};
