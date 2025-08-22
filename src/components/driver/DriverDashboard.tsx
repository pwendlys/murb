import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Navigation, DollarSign, Star } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Ride, RideStatus, Profile, UserType } from '@/types';
import { toast } from 'sonner';
import { RideNotifications } from './RideNotifications';
import { DriverLocationToggle } from './DriverLocationToggle';
import { RideCard } from './RideCard';
import { DriverStats } from './DriverStats';
import { DriverEarnings } from './DriverEarnings';
import { DriverReviews } from './DriverReviews';

export const DriverDashboard = () => {
  const { user } = useAuth();
  const [pendingRides, setPendingRides] = useState<Ride[]>([]);
  const [myRides, setMyRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'accepted' | 'in_progress'>('all');

  useEffect(() => {
    if (user) {
      fetchRides();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('driver-rides')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rides'
          },
          () => fetchRides()
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchRides = async () => {
    if (!user) return;
    
    try {
      // Fetch pending rides
      const { data: pending, error: pendingError } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (pendingError) throw pendingError;

      // Fetch driver's rides
      const { data: driverRides, error: driverError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['accepted', 'in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (driverError) throw driverError;

      // Fetch passenger profiles for all rides
      const allRideIds = [...(pending || []), ...(driverRides || [])];
      const passengerIds = [...new Set(allRideIds.map(ride => ride.passenger_id))];
      
      let passengerProfiles: Profile[] = [];
      if (passengerIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at')
          .in('id', passengerIds);

        if (profilesError) throw profilesError;
        passengerProfiles = profiles?.map(profile => ({
          ...profile,
          user_type: profile.user_type as UserType
        })) || [];
      }

      // Map profiles to rides
      const processRides = (rides: any[]): Ride[] => {
        return rides.map(ride => ({
          ...ride,
          status: ride.status as RideStatus,
          profiles: passengerProfiles.find(profile => profile.id === ride.passenger_id) || null
        }));
      };

      setPendingRides(processRides(pending || []));
      setMyRides(processRides(driverRides || []));
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      toast.error('Erro ao carregar corridas');
    } finally {
      setLoading(false);
    }
  };

  const filteredMyRides = myRides.filter(ride => {
    if (filter === 'all') return true;
    return ride.status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-2">
          <h1 className="text-3xl font-bold text-primary">Painel do Motorista</h1>
          <RideNotifications />
        </div>
        <p className="text-muted-foreground">Aceite corridas, gerencie trajetos e acompanhe seus ganhos</p>
      </div>

      {/* Driver Stats */}
      <DriverStats />

      <Tabs defaultValue="rides" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rides">Corridas</TabsTrigger>
          <TabsTrigger value="earnings">
            <DollarSign className="w-4 h-4 mr-1" />
            Ganhos
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="w-4 h-4 mr-1" />
            Avaliações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rides" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Driver Location Toggle */}
            <div className="lg:col-span-1">
              <DriverLocationToggle />
            </div>

            {/* Available Rides */}
            <div className="lg:col-span-2">
              <Card className="shadow-ride-card border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    Corridas Disponíveis
                    {pendingRides.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        {pendingRides.length}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent data-ride-list>
                  {pendingRides.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhuma corrida pendente</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {pendingRides.map((ride) => (
                        <RideCard
                          key={ride.id}
                          ride={ride}
                          type="pending"
                          onUpdate={fetchRides}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* My Rides */}
          <Card className="shadow-ride-card border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  Minhas Corridas
                </CardTitle>
                
                <div className="flex gap-2">
                  {['all', 'accepted', 'in_progress'].map((filterOption) => (
                    <Button
                      key={filterOption}
                      variant={filter === filterOption ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilter(filterOption as typeof filter)}
                    >
                      {filterOption === 'all' ? 'Todas' : 
                       filterOption === 'accepted' ? 'Aceitas' : 'Em Andamento'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMyRides.length === 0 ? (
                <div className="text-center py-8">
                  <Navigation className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {filter === 'all' ? 'Nenhuma corrida aceita' : 
                     filter === 'accepted' ? 'Nenhuma corrida aceita' :
                     'Nenhuma corrida em andamento'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredMyRides.map((ride) => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      type="accepted"
                      onUpdate={fetchRides}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings">
          <DriverEarnings />
        </TabsContent>

        <TabsContent value="reviews">
          <DriverReviews />
        </TabsContent>
      </Tabs>
    </div>
  );
};
