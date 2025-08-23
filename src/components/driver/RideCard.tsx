import { useState } from 'react';
import { Ride } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MapPin, Clock, User, Navigation, CheckCircle, Car, Phone, MessageCircle, Banknote, QrCode, CreditCard, XCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { calculateRoute } from '@/services/googleMaps';
import { ChatButton } from '@/components/chat/ChatButton';
import { ChatDialog } from '@/components/chat/ChatDialog';
import { useChat } from '@/hooks/useChat';

interface RideCardProps {
  ride: Ride;
  type: 'pending' | 'accepted';
  onUpdate?: () => void;
}

export const RideCard = ({ ride, type, onUpdate }: RideCardProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [goingToPassengerLoading, setGoingToPassengerLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);

  // Hook do chat (só ativar quando corrida está aceita/em andamento)
  const shouldEnableChat = type === 'accepted' && ['accepted', 'in_progress'].includes(ride.status);
  const { unreadCount } = useChat({ 
    rideId: ride.id, 
    receiverId: ride.passenger_id 
  });

  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          resolve({
            lat: ride.origin_lat,
            lng: ride.origin_lng
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  const generateGoogleMapsUrl = () => {
    try {
      const origin = `${ride.origin_lat},${ride.origin_lng}`;
      const destination = `${ride.destination_lat},${ride.destination_lng}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    } catch (error) {
      console.error('Error generating maps URL:', error);
      return `https://www.google.com/maps/search/?api=1&query=${ride.destination_lat},${ride.destination_lng}`;
    }
  };

  const generateToPassengerMapsUrl = (currentLocation: { lat: number; lng: number }) => {
    try {
      const origin = `${currentLocation.lat},${currentLocation.lng}`;
      const destination = `${ride.origin_lat},${ride.origin_lng}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
    } catch (error) {
      console.error('Error generating maps URL:', error);
      return `https://www.google.com/maps/search/?api=1&query=${ride.origin_lat},${ride.origin_lng}`;
    }
  };

  const handleGoToPassenger = async () => {
    setGoingToPassengerLoading(true);
    try {
      const currentLocation = await getCurrentLocation();
      const routeDetails = await calculateRoute(
        currentLocation,
        { lat: ride.origin_lat, lng: ride.origin_lng }
      );
      const { error } = await supabase
        .from('rides')
        .update({
          driver_en_route: true,
          en_route_started_at: new Date().toISOString(),
          driver_to_pickup_distance_km: parseFloat(routeDetails.distance.replace(' km', '').replace(',', '.')),
          driver_to_pickup_duration_min: parseInt(routeDetails.duration.replace(' mins', '').replace(' min', '')),
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id);
      if (error) throw error;
      const mapsUrl = generateToPassengerMapsUrl(currentLocation);
      window.open(mapsUrl, '_blank');
      toast.success('Indo até o passageiro!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error going to passenger:', error);
      toast.error('Erro ao calcular rota até o passageiro');
    } finally {
      setGoingToPassengerLoading(false);
    }
  };

  const handleGoToMaps = async () => {
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          driver_en_route: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id);
      if (error) throw error;
      const mapsUrl = generateGoogleMapsUrl();
      window.open(mapsUrl, '_blank');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error opening maps:', error);
      toast.error('Erro ao abrir o mapa');
    }
  };

  const handleAcceptRide = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          driver_id: user.id,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id)
        .eq('status', 'pending');
      if (error) throw error;
      toast.success('Corrida aceita com sucesso!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      if (error.message?.includes('No rows updated')) {
        toast.error('Esta corrida já foi aceita por outro mototaxista');
      } else {
        toast.error('Erro ao aceitar corrida');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('rides')
        .update(updates)
        .eq('id', ride.id);
      if (error) throw error;
      const statusText = {
        'completed': 'finalizada'
      }[newStatus] || 'atualizada';
      toast.success(`Corrida ${statusText}!`);
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating ride status:', error);
      toast.error('Erro ao atualizar status da corrida');
    } finally {
      setLoading(false);
    }
  };

  const handleDriverArrived = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          driver_arrived: true,
          pickup_arrived_at: new Date().toISOString(),
          driver_en_route: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id);

      if (error) throw error;

      toast.success('Você chegou ao passageiro!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error setting driver arrived:', error);
      toast.error('Erro ao atualizar chegada ao passageiro');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!user) return;
    
    const confirmed = window.confirm('Tem certeza que deseja cancelar esta corrida? Ela voltará para a fila.');
    if (!confirmed) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'pending',
          driver_id: null,
          started_at: null,
          driver_en_route: false,
          en_route_started_at: null,
          driver_to_pickup_distance_km: null,
          driver_to_pickup_duration_min: null,
          driver_arrived: false,
          pickup_arrived_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ride.id)
        .eq('driver_id', user.id)
        .eq('status', 'in_progress');

      if (error) throw error;
      
      toast.success('Corrida cancelada. A chamada voltou para a fila.');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error cancelling ride:', error);
      toast.error('Não foi possível cancelar a corrida.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      pending: 'Pendente',
      accepted: 'Aceita',
      in_progress: 'Em andamento',
      completed: 'Finalizada'
    };
    return statusMap[status as keyof typeof statusMap] || status;
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
      default:
        return 'secondary';
    }
  };

  const getPaymentMethodDisplay = (method: string | null | undefined) => {
    if (!method) {
      return {
        icon: <CreditCard className="w-3 h-3" />,
        label: 'Não informado'
      };
    }

    switch (method.toLowerCase()) {
      case 'dinheiro':
        return {
          icon: <Banknote className="w-3 h-3" />,
          label: 'Dinheiro'
        };
      case 'pix':
        return {
          icon: <QrCode className="w-3 h-3" />,
          label: 'Pix'
        };
      case 'cartao':
        return {
          icon: <CreditCard className="w-3 h-3" />,
          label: 'Cartão'
        };
      default:
        return {
          icon: <CreditCard className="w-3 h-3" />,
          label: method
        };
    }
  };

  const paymentDisplay = getPaymentMethodDisplay(ride.payment_method);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {type === 'pending' ? (
                <Badge variant="secondary">Disponível</Badge>
              ) : (
                <Badge variant={getStatusVariant(ride.status)}>
                  {getStatusText(ride.status)}
                </Badge>
              )}
              {/* Badge Moto Negocia - detectar pela presença de oferta customizada */}
              {ride.estimated_price && ride.estimated_price !== ride.actual_price && (
                <Badge variant="outline" className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-800 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-700 dark:text-amber-300">
                  Moto Negocia
                </Badge>
              )}
            </div>
            {ride.estimated_price && (
              <div className="text-right">
                <span className="font-semibold text-primary text-lg">
                  R$ {ride.estimated_price.toFixed(2)}
                </span>
                {/* Se é moto negocia, mostrar que é uma oferta */}
                {ride.estimated_price && ride.estimated_price !== ride.actual_price && (
                  <div className="text-xs text-muted-foreground">
                    Oferta do passageiro
                  </div>
                )}
              </div>
            )}
          </div>

          {ride.profiles && (
            <>
              <div className="flex items-center gap-3 mb-4 p-2 bg-muted/30 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage 
                    src={ride.profiles?.avatar_url || undefined} 
                    alt={ride.profiles?.full_name || 'Passageiro'} 
                  />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {ride.profiles?.full_name ? ride.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">Passageiro</p>
                    {/* Chat Button para mototaxistas */}
                    {shouldEnableChat && user && (
                      <ChatButton
                        unreadCount={unreadCount}
                        onClick={() => setChatDialogOpen(true)}
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{ride.profiles?.full_name}</p>
                </div>
              </div>

              {/* Payment Method Display */}
              <div className="mb-4 p-2 bg-muted/20 rounded-lg border border-border/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Pagamento:</span>
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-xs border border-border/50">
                    {paymentDisplay.icon}
                    <span className="font-medium">{paymentDisplay.label}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <span className="font-medium">{ride.profiles?.full_name}</span>
                {ride.profiles?.phone && (
                  <span className="text-sm text-muted-foreground ml-2">
                    {ride.profiles.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm text-muted-foreground">De:</span>
                <p className="text-sm">{ride.origin_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm text-muted-foreground">Para:</span>
                <p className="text-sm">{ride.destination_address}</p>
              </div>
            </div>
            {(ride.estimated_distance || ride.estimated_duration) && (
              <div className="flex items-center gap-4 pt-2">
                {ride.estimated_distance && (
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {ride.estimated_distance} km
                    </span>
                  </div>
                )}
                {ride.estimated_duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {ride.estimated_duration} min
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {type === 'pending' ? (
              <Button
                onClick={handleAcceptRide}
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark"
                size="sm"
              >
                {loading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Car className="w-4 h-4 mr-2" />
                    Aceitar Corrida
                  </>
                )}
              </Button>
            ) : (
              <>
                {ride.status === 'in_progress' && (
                  <div className="flex gap-2">
                    {!ride.driver_arrived ? (
                      <>
                        <Button
                          onClick={handleGoToPassenger}
                          disabled={goingToPassengerLoading}
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {goingToPassengerLoading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <User className="w-4 h-4 mr-2" />
                              Ir Até Passageiro
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleDriverArrived}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          {loading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Cheguei
                            </>
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleGoToMaps}
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Navigation className="w-4 h-4 mr-2" />
                          Ir Agora
                        </Button>
                        <Button
                          onClick={() => handleUpdateStatus('completed')}
                          disabled={loading}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          {loading ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Finalizar
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {ride.status === 'in_progress' && !ride.driver_arrived && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={handleCancelRide}
                      disabled={cancelling || goingToPassengerLoading || loading}
                      size="sm"
                      variant="destructive"
                      className="w-full"
                    >
                      {cancelling ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Cancelar
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {ride.profiles?.phone && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(`tel:${ride.profiles?.phone}`)}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Ligar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(`sms:${ride.profiles?.phone}`)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      SMS
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-xs text-muted-foreground mt-3 pt-2 border-t">
            Criada em: {new Date(ride.created_at).toLocaleString('pt-BR')}
          </div>
        </CardContent>
      </Card>

      {/* Chat Dialog para mototaxistas */}
      {shouldEnableChat && user && ride.profiles && (
        <ChatDialog
          isOpen={chatDialogOpen}
          onClose={() => setChatDialogOpen(false)}
          rideId={ride.id}
          receiver={{
            id: ride.passenger_id,
            full_name: ride.profiles.full_name,
            avatar_url: ride.profiles.avatar_url
          }}
          currentUserId={user.id}
        />
      )}
    </>
  );
};
