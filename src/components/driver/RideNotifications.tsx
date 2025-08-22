
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ride } from '@/types';

export const RideNotifications = () => {
  const { user } = useAuth();
  const [newRideCount, setNewRideCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Subscribe to new rides
    const subscription = supabase
      .channel('new-rides')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: 'status=eq.pending'
        },
        (payload) => {
          const newRide = payload.new as Ride;
          setNewRideCount(prev => prev + 1);
          
          if (soundEnabled) {
            // Play notification sound
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => {}); // Ignore if sound fails
          }
          
          toast.success('Nova corrida disponível!', {
            description: `De ${newRide.origin_address} para ${newRide.destination_address}`,
            duration: 5000,
            action: {
              label: 'Ver',
              onClick: () => {
                document.querySelector('[data-ride-list]')?.scrollIntoView({ behavior: 'smooth' });
              }
            }
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, soundEnabled]);

  const clearNotifications = () => {
    setNewRideCount(0);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={soundEnabled ? "default" : "outline"}
        size="sm"
        onClick={() => setSoundEnabled(!soundEnabled)}
      >
        {soundEnabled ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      </Button>
      
      {newRideCount > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={clearNotifications}
            className="relative"
          >
            <Bell className="w-4 h-4" />
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
            >
              {newRideCount}
            </Badge>
          </Button>
        </div>
      )}
    </div>
  );
};
