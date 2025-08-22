
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LocationCoords } from '@/services/googleMaps';

export interface DriverLocation extends LocationCoords {
  heading?: number;
  speed?: number;
  timestamp: string;
}

export const useLiveDriverLocation = (driverId: string | null, isActive: boolean = false) => {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch driver location
  const fetchDriverLocation = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', driverId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle instead of single to handle empty results

      if (error) {
        console.error('Error fetching driver location:', error);
        setError('Erro ao buscar localização do motorista');
        return;
      }

      if (data) {
        const newLocation: DriverLocation = {
          lat: data.lat,
          lng: data.lng,
          heading: data.heading || undefined,
          speed: data.speed || undefined,
          timestamp: data.timestamp
        };

        // Always update location to ensure real-time tracking
        setDriverLocation(newLocation);
        setLastUpdateAt(new Date().toISOString()); // Set local update time
        setError(null);
        console.log('Driver location updated:', newLocation);
      } else {
        console.log('No location data found for driver:', driverId);
      }
    } catch (err) {
      console.error('Error in fetchDriverLocation:', err);
      setError('Erro ao conectar com o servidor');
    }
  };

  // Setup polling with fixed 5-second intervals
  useEffect(() => {
    if (!isActive || !driverId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDriverLocation(null);
      setLastUpdateAt(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Initial fetch
    fetchDriverLocation().finally(() => setLoading(false));

    // Setup interval with fixed 5-second timing for consistent updates
    intervalRef.current = setInterval(() => {
      fetchDriverLocation();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [driverId, isActive]);

  // Setup realtime subscription for both INSERT and UPDATE events
  useEffect(() => {
    if (!isActive || !driverId) return;

    const channel = supabase
      .channel('driver-location-tracking')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'locations',
          filter: `user_id=eq.${driverId}`
        },
        (payload) => {
          console.log('Realtime location INSERT:', payload);
          const newRecord = payload.new as any;
          if (newRecord) {
            const newLocation: DriverLocation = {
              lat: newRecord.lat,
              lng: newRecord.lng,
              heading: newRecord.heading || undefined,
              speed: newRecord.speed || undefined,
              timestamp: newRecord.timestamp
            };

            setDriverLocation(newLocation);
            setLastUpdateAt(new Date().toISOString()); // Set local update time
            setError(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locations',
          filter: `user_id=eq.${driverId}`
        },
        (payload) => {
          console.log('Realtime location UPDATE:', payload);
          const newRecord = payload.new as any;
          if (newRecord) {
            const newLocation: DriverLocation = {
              lat: newRecord.lat,
              lng: newRecord.lng,
              heading: newRecord.heading || undefined,
              speed: newRecord.speed || undefined,
              timestamp: newRecord.timestamp
            };

            setDriverLocation(newLocation);
            setLastUpdateAt(new Date().toISOString()); // Set local update time
            setError(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, isActive]);

  return {
    driverLocation,
    loading,
    error,
    lastUpdateAt,
    refetch: fetchDriverLocation
  };
};
