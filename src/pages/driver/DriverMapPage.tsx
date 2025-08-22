import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { AuthSelector } from '@/components/auth/AuthSelector';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GoogleMap } from '@/components/ui/google-map';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverLocationToggle } from '@/components/driver/DriverLocationToggle';
import { RideCard } from '@/components/driver/RideCard';
import { RideNotifications } from '@/components/driver/RideNotifications';
import { LocationCoords } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Ride } from '@/types';
import { MapPin } from 'lucide-react';

export const DriverMapPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState<LocationCoords | null>(null);
  const [driverRides, setDriverRides] = useState<Ride[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          // Fallback to São Paulo coordinates
          setCurrentLocation({ lat: -23.5505, lng: -46.6333 });
        }
      );
    } else {
      // Fallback to São Paulo coordinates
      setCurrentLocation({ lat: -23.5505, lng: -46.6333 });
    }
  }, []);

  // Fetch driver rides (pending + accepted/in_progress)
  const fetchDriverRides = async () => {
    if (!user) return;
    
    console.log('Fetching driver rides...');
    
    try {
      // Get pending rides (available for all drivers) and accepted/in_progress rides for current driver
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .or(`status.eq.pending,and(driver_id.eq.${user.id},status.in.(accepted,in_progress))`)
        .order('created_at', { ascending: false });

      if (ridesError) {
        console.error('Error fetching driver rides:', ridesError);
        throw ridesError;
      }

      console.log('Driver rides fetched:', ridesData?.length || 0);

      if (!ridesData || ridesData.length === 0) {
        setDriverRides([]);
        setRidesLoading(false);
        return;
      }

      // Get unique passenger IDs
      const passengerIds = [...new Set(ridesData.map(ride => ride.passenger_id))];
      
      // Fetch passenger profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, avatar_url')
        .in('id', passengerIds);

      if (profilesError) {
        console.error('Error fetching passenger profiles:', profilesError);
        // Continue without profiles data
      }

      // Combine rides with profiles
      const ridesWithProfiles = ridesData.map(ride => ({
        ...ride,
        profiles: profilesData?.find(profile => profile.id === ride.passenger_id)
      }));

      console.log('Final driver rides with profiles:', ridesWithProfiles.length);
      setDriverRides(ridesWithProfiles as unknown as Ride[]);
    } catch (error) {
      console.error('Error fetching driver rides:', error);
    } finally {
      setRidesLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverRides();

    // Subscribe to ride changes
    const channel = supabase
      .channel('driver-map-rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides'
        },
        () => {
          fetchDriverRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Mapa - RideBuddy Driver';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Veja corridas disponíveis no mapa e ative sua localização para receber mais solicitações.');
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', window.location.origin + '/driver/map');
    }

    return () => {
      document.title = 'RideBuddy';
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <AuthSelector />;
  }

  return (
    <div className="relative min-h-screen bg-background">
      <RideNotifications />
      
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <GoogleMap 
          origin={currentLocation || undefined}
          className="w-full h-full"
        />
      </div>

      {/* Floating overlay content */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Logo and Driver location toggle - top left */}
        <div className="absolute top-4 left-4 pointer-events-auto flex items-center gap-3">
          <img src="/lovable-uploads/1c86ad9a-22a0-4049-9e51-eb23e2623bc1.png" alt="Viaja+" className="h-8 w-auto" />
          <DriverLocationToggle />
        </div>

        {/* Driver rides - right side, more compact */}
        {!ridesLoading && driverRides.length > 0 && (
          <div className="absolute top-16 right-4 bottom-20 pointer-events-auto w-96 max-w-[calc(100vw-2rem)]">
            <div className="bg-background/95 backdrop-blur rounded-lg shadow-lg border h-full flex flex-col">
              <div className="p-3 border-b border-border/20">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  Corridas ({driverRides.length})
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {driverRides.map((ride) => (
                  <div key={ride.id} className="pointer-events-auto">
                    <RideCard 
                      ride={ride}
                      type={ride.status === 'pending' ? 'pending' : 'accepted'}
                      onUpdate={() => {
                        fetchDriverRides();
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* No rides message - more compact */}
        {!ridesLoading && driverRides.length === 0 && (
          <div className="absolute top-16 right-4 pointer-events-auto">
            <div className="bg-background/95 backdrop-blur rounded-lg p-3 shadow-lg border max-w-xs">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>Nenhuma corrida disponível. Mantenha sua localização ativa.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <DriverBottomNavigation />
    </div>
  );
};