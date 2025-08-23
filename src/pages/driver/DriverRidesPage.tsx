import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverCompletedRideCard } from '@/components/driver/DriverCompletedRideCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Clock, DollarSign, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Ride } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const DriverRidesPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rides, setRides] = useState<Ride[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress' | 'cancelled'>('all');

  const fetchRides = async () => {
    if (!user) return;
    
    console.log('Fetching rides for driver:', user.id);
    
    try {
      // First, get the rides without join
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .neq('status', 'pending')
        .order('created_at', { ascending: false });

      if (ridesError) {
        console.error('Error fetching rides:', ridesError);
        throw ridesError;
      }

      console.log('Rides fetched:', ridesData?.length || 0);

      if (!ridesData || ridesData.length === 0) {
        setRides([]);
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
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles data
      }

      // Combine rides with profiles
      const ridesWithProfiles = ridesData.map(ride => ({
        ...ride,
        profiles: profilesData?.find(profile => profile.id === ride.passenger_id)
      }));

      console.log('Final rides with profiles:', ridesWithProfiles.length);
      setRides(ridesWithProfiles as unknown as Ride[]);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setRidesLoading(false);
    }
  };

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchRides();
  }, [user]);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Minhas Corridas - RideBuddy Driver';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Visualize o histórico completo das suas corridas realizadas como mototaxista.');
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', window.location.origin + '/driver/rides');
    }

    return () => {
      document.title = 'RideBuddy';
    };
  }, []);

  const filteredRides = rides.filter(ride => {
    if (filter === 'all') return true;
    return ride.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'in_progress': return 'Em Andamento';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Minhas Corridas</h1>
          <p className="text-muted-foreground">
            Histórico completo das suas corridas realizadas
          </p>
        </header>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="completed">Concluídas</TabsTrigger>
            <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="space-y-4">
            {ridesLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : filteredRides.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <p className="text-muted-foreground">
                    {filter === 'all' 
                      ? 'Você ainda não realizou nenhuma corrida'
                      : `Nenhuma corrida ${getStatusLabel(filter).toLowerCase()} encontrada`
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredRides.map((ride) => (
                ride.status === 'completed' ? (
                  <DriverCompletedRideCard 
                    key={ride.id} 
                    ride={ride} 
                    onRatingSubmitted={fetchRides}
                  />
                ) : (
                  <Card key={ride.id} className="shadow-ride-card border-0">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          {ride.profiles?.full_name || 'Passageiro'}
                        </CardTitle>
                        <Badge className={getStatusColor(ride.status)}>
                          {getStatusLabel(ride.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Origem</p>
                            <p className="text-sm text-muted-foreground">{ride.origin_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">Destino</p>
                            <p className="text-sm text-muted-foreground">{ride.destination_address}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">Data</p>
                            <p className="text-sm font-medium">
                              {format(new Date(ride.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">Horário</p>
                            <p className="text-sm font-medium">
                              {format(new Date(ride.created_at), 'HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>

                      {ride.actual_price && (
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-xs text-muted-foreground">Valor da Corrida</p>
                            <p className="text-lg font-bold text-green-600">
                              R$ {Number(ride.actual_price).toFixed(2).replace('.', ',')}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <DriverBottomNavigation />
    </div>
  );
};