import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RateDriverDialog } from '@/components/passenger/RateDriverDialog';
import { MapPin, Clock, Car, CheckCircle, XCircle, Star, X } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Ride, RideStatus, Profile, DriverDetails } from '@/types';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import BottomNavigation from '@/components/layout/BottomNavigation';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { AuthSelector } from '@/components/auth/AuthSelector';

const RidesPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);
  const [ratedRides, setRatedRides] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [selectedRideForRating, setSelectedRideForRating] = useState<Ride | null>(null);
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      fetchRides();
      const subscription = supabase
        .channel('passenger-rides')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rides',
            filter: `passenger_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Ride update:', payload);
            fetchRides();
            if (payload.eventType === 'UPDATE' && (payload as any).new.status === 'completed') {
              checkAndAutoOpenRatingDialog((payload as any).new.id);
            }
          }
        )
        .subscribe();
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    document.title = "Suas Corridas - App";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Acompanhe o histórico das suas corridas, avalie mototaxistas e gerencie suas viagens.');
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonicalLink) {
      canonicalLink.href = `${window.location.origin}/rides`;
    }

    return () => {
      document.title = "App";
    };
  }, []);

  const fetchRides = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (data && data.length > 0) {
        const driverIds = [...new Set(
          data.map(ride => ride.driver_id).filter(id => id !== null)
        )] as string[];

        let driverProfiles: any[] = [];
        if (driverIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at')
            .in('id', driverIds);
          if (profilesError) throw profilesError;
          driverProfiles = profiles || [];
        }

        let driverDetails: DriverDetails[] = [];
        if (driverIds.length > 0) {
          const { data: details, error: detailsError } = await supabase
            .from('driver_details')
            .select('user_id, vehicle_brand, vehicle_model, vehicle_color, vehicle_plate')
            .in('user_id', driverIds);
          if (detailsError) throw detailsError;
          driverDetails = (details as DriverDetails[]) || [];
        }

        const processedRides: Ride[] = data.map((ride) => ({
          ...ride,
          status: ride.status as RideStatus,
          profiles: ride.driver_id 
            ? driverProfiles.find(profile => profile.id === ride.driver_id) || null
            : null,
          driver_details: ride.driver_id
            ? driverDetails.find(d => d.user_id === ride.driver_id) || null
            : null,
        }));

        setRides(processedRides);

        const completedRideIds = processedRides
          .filter(ride => ride.status === 'completed')
          .map(ride => ride.id);

        if (completedRideIds.length > 0) {
          const { data: ratings } = await supabase
            .from('ride_ratings')
            .select('ride_id')
            .in('ride_id', completedRideIds);
          if (ratings) {
            setRatedRides(new Set(ratings.map(rating => rating.ride_id)));
          }
        }
      } else {
        setRides([]);
      }
    } catch (error: any) {
      console.error('Error fetching rides:', error);
      toast.error('Erro ao carregar corridas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async (ride: Ride) => {
    if (!user) return;

    if (ride.status === 'completed') {
      toast.error('Não é possível cancelar uma corrida já finalizada');
      return;
    }

    if (ride.status === 'accepted' || ride.status === 'in_progress') {
      toast.error('Não é possível cancelar: o mototaxista já aceitou a corrida e está a caminho!', {
        style: {
          backgroundColor: '#dc2626',
          color: 'white',
          border: '1px solid #b91c1c'
        }
      });
      return;
    }

    setCancellingRideId(ride.id);
    try {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'cancelled' })
        .eq('id', ride.id)
        .eq('passenger_id', user.id);

      if (error) throw error;

      toast.success('Corrida cancelada com sucesso');
      fetchRides();
    } catch (error: any) {
      console.error('Error cancelling ride:', error);
      toast.error('Erro ao cancelar corrida');
    } finally {
      setCancellingRideId(null);
    }
  };

  const checkAndAutoOpenRatingDialog = async (rideId: string) => {
    try {
      const { data: existingRating } = await supabase
        .from('ride_ratings')
        .select('id')
        .eq('ride_id', rideId)
        .single();
      if (!existingRating) {
        const ride = rides.find(r => r.id === rideId);
        if (ride && ride.status === 'completed' && ride.profiles) {
          setSelectedRideForRating(ride);
          setRateDialogOpen(true);
          toast.info('Sua corrida foi finalizada! Avalie o mototaxista.');
        }
      }
    } catch (error) {
      console.error('Error checking rating status:', error);
    }
  };

  const handleRateDriver = (ride: Ride) => {
    setSelectedRideForRating(ride);
    setRateDialogOpen(true);
  };

  const handleRatingSubmitted = () => {
    if (selectedRideForRating) {
      setRatedRides(prev => new Set([...prev, selectedRideForRating.id]));
    }
    setSelectedRideForRating(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'accepted':
      case 'in_progress':
        return <Car className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4 animate-spin" />;
    }
  };

  const getStatusText = (status: string, ride?: Ride) => {
    if (status === 'accepted') {
      return 'Corrida Aceita';
    }
    if (status === 'in_progress') {
      if (ride?.driver_arrived) {
        if (ride?.driver_en_route === false) {
          return 'Corrida Em Andamento';
        }
        return 'Mototaxista Chegou';
      }
      if (ride?.driver_en_route === true) {
        return 'Mototaxista Indo Até Você';
      }
      return 'Em andamento';
    }
    const statusMap = {
      pending: 'Aguardando',
      completed: 'Viagem Finalizada',
      cancelled: 'Cancelada'
    } as const;
    return (statusMap as any)[status] || status;
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'default';
      case 'in_progress':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-primary mb-2">Suas Corridas</h1>
          <p className="text-muted-foreground">Histórico completo das suas viagens</p>
        </div>

        <Card className="shadow-ride-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" />
              Histórico de Corridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Nenhuma corrida encontrada</p>
                <p className="text-sm text-muted-foreground mt-2">Suas corridas aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rides.map((ride) => (
                  <div key={ride.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant={getStatusVariant(ride.status)} 
                          className="flex items-center gap-1"
                        >
                          {getStatusIcon(ride.status)}
                          {getStatusText(ride.status, ride)}
                        </Badge>
                        
                        {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelRide(ride)}
                            disabled={cancellingRideId === ride.id}
                            className="h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 flex-shrink-0"
                          >
                            {cancellingRideId === ride.id ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                Cancelar
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {ride.estimated_price && (
                        <span className="font-semibold text-primary">
                          R$ {ride.estimated_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    
                    {ride.profiles && (ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'completed') && (
                      <div className="flex items-center gap-3 mb-4 p-2 bg-muted/30 rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarImage 
                            src={ride.profiles?.avatar_url || undefined} 
                            alt={ride.profiles?.full_name || 'Mototaxista'} 
                          />
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {ride.profiles?.full_name ? ride.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">Mototaxista</p>
                          <p className="text-sm text-muted-foreground">{ride.profiles?.full_name}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-muted-foreground block">De:</span>
                          <span className="font-medium">{ride.origin_address}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-muted-foreground block">Para:</span>
                          <span className="font-medium">{ride.destination_address}</span>
                        </div>
                      </div>

                      {ride.driver_details && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Car className="w-4 h-4" />
                          <span>
                            Veículo: {[
                              ride.driver_details.vehicle_brand,
                              ride.driver_details.vehicle_model
                            ].filter(Boolean).join(' ')}
                            {ride.driver_details.vehicle_color ? ` (${ride.driver_details.vehicle_color})` : ''}
                            {ride.driver_details.vehicle_plate ? ` • Placa: ${ride.driver_details.vehicle_plate}` : ''}
                          </span>
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        {new Date(ride.created_at).toLocaleString('pt-BR')}
                      </div>

                      {ride.status === 'completed' && ride.profiles && !ratedRides.has(ride.id) && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRateDriver(ride)}
                            className="flex items-center gap-2"
                          >
                            <Star className="w-3 h-3" />
                            Avaliar Mototaxista
                          </Button>
                        </div>
                      )}

                      {ratedRides.has(ride.id) && (
                        <div className="pt-2">
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Já avaliado
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <RateDriverDialog
          open={rateDialogOpen}
          onOpenChange={setRateDialogOpen}
          ride={selectedRideForRating}
          onSubmitted={handleRatingSubmitted}
        />
      </main>

      {/* Show appropriate navigation based on user type */}
      {profile?.user_type === 'driver' ? (
        <DriverBottomNavigation />
      ) : (
        <BottomNavigation />
      )}
    </div>
  );
};

export default RidesPage;