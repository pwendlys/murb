import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Ride } from '@/types';

export const useActiveRide = () => {
  const { user } = useAuth();
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActiveRide = async () => {
    if (!user) {
      setActiveRide(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('passenger_id', user.id)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active ride:', error);
        setActiveRide(null);
      } else if (data) {
        // Fetch driver details separately if needed
        let rideWithDetails = data as any;
        
        if (data.driver_id) {
          // Fetch driver profile
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('id, full_name, phone, avatar_url')
            .eq('id', data.driver_id)
            .single();
          
          // Fetch driver details
          const { data: driverDetails } = await supabase
            .from('driver_details')
            .select('vehicle_brand, vehicle_model, vehicle_color, vehicle_plate')
            .eq('user_id', data.driver_id)
            .single();
          
          rideWithDetails.profiles = driverProfile;
          rideWithDetails.driver_details = driverDetails;
        }
        
        setActiveRide(rideWithDetails);
      } else {
        setActiveRide(null);
      }
    } catch (error) {
      console.error('Error fetching active ride:', error);
      setActiveRide(null);
    } finally {
      setLoading(false);
    }
  };

  const cancelRide = async (rideId: string) => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', rideId)
        .eq('passenger_id', user?.id);

      if (error) throw error;
      
      // Refresh the active ride after cancellation
      fetchActiveRide();
      return true;
    } catch (error) {
      console.error('Error canceling ride:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchActiveRide();
  }, [user]);

  // Set up real-time subscription for ride updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('active-ride-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `passenger_id=eq.${user.id}`
        },
        (payload) => {
          // Only update if it's a relevant ride status
          const newRecord = payload.new as any;
          if (newRecord && ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'].includes(newRecord.status)) {
            fetchActiveRide();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    activeRide,
    loading,
    cancelRide,
    refreshActiveRide: fetchActiveRide
  };
};