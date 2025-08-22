import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Ride } from '@/types';
import { 
  Clock, 
  CheckCircle, 
  Car, 
  MapPin, 
  Navigation, 
  DollarSign, 
  User,
  Phone,
  X,
  AlertTriangle,
  Map,
  Banknote,
  QrCode,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DriverTrackingDialog } from './DriverTrackingDialog';
import { ChatButton } from '@/components/chat/ChatButton';
import { ChatDialog } from '@/components/chat/ChatDialog';
import { useAuth } from '@/hooks/useAuth';
import { useChat } from '@/hooks/useChat';

interface ActiveRideTrackingProps {
  ride: Ride;
  onCancel: (rideId: string) => Promise<boolean>;
}

export const ActiveRideTracking: React.FC<ActiveRideTrackingProps> = ({ ride, onCancel }) => {
  const { user } = useAuth();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [trackingDialogOpen, setTrackingDialogOpen] = useState(false);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);

  // Hook do chat (só ativar quando há motorista e corrida aceita/em andamento)
  const shouldEnableChat = ride.driver_id && ['accepted', 'in_progress'].includes(ride.status);
  const { unreadCount } = useChat({ 
    rideId: ride.id, 
    receiverId: ride.driver_id || '' 
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'accepted':
      case 'in_progress':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4 animate-spin" />;
    }
  };

  const getStatusText = (status: string) => {
    if (status === 'accepted') {
      return 'Mototaxista a caminho';
    }
    if (status === 'in_progress') {
      if (ride.driver_arrived) {
        return 'Mototaxista chegou';
      }
      return 'Corrida em andamento';
    }
    return 'Aguardando mototaxista';
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'accepted':
        return 'default';
      case 'in_progress':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);
    try {
      const success = await onCancel(ride.id);
      if (success) {
        toast.success('Corrida cancelada com sucesso');
      } else {
        toast.error('Erro ao cancelar corrida');
      }
    } catch (error) {
      toast.error('Erro ao cancelar corrida');
    } finally {
      setCancelLoading(false);
    }
  };

  const canCancel = ['pending', 'accepted'].includes(ride.status);
  const canTrackDriver = ride.driver_id && ['accepted', 'in_progress'].includes(ride.status);

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
      <div className="bg-background/90 backdrop-blur rounded-lg p-3 border border-border/50">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant={getStatusVariant(ride.status)} 
            className="flex items-center gap-2 px-3 py-1"
          >
            {getStatusIcon(ride.status)}
            {getStatusText(ride.status)}
          </Badge>
          
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 border-destructive/50 hover:bg-destructive/10"
                  disabled={cancelLoading}
                >
                  <X className="w-3 h-3 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Cancelar Corrida
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar esta corrida? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, Cancelar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="h-[320px] sm:h-[360px]" type="always">
          <div className="space-y-3 pr-2">
            {/* Route Information */}
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">De: </span>
                  <span className="font-medium">{ride.origin_address}</span>
                </div>
              </div>
              
              <div className="flex items-start gap-2 text-sm">
                <Navigation className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground">Para: </span>
                  <span className="font-medium">{ride.destination_address}</span>
                </div>
              </div>
            </div>

            {/* Ride Details */}
            <div className="flex justify-between items-center p-2.5 bg-background/50 rounded-lg border border-border/30">
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3 text-primary" />
                <span className="text-sm font-medium">{ride.estimated_distance?.toFixed(1)} km</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-sm font-medium">{ride.estimated_duration} min</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-primary" />
                <span className="text-sm font-bold text-primary">R$ {ride.estimated_price?.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Display */}
            <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pagamento:</span>
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-background text-sm border border-border/50">
                  {paymentDisplay.icon}
                  <span className="font-medium">{paymentDisplay.label}</span>
                </div>
              </div>
            </div>

            {/* Driver Information */}
            {ride.status !== 'pending' && ride.profiles && (
              <div className="p-2.5 bg-background/50 rounded-lg border border-border/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
                    {ride.profiles.avatar_url ? (
                      <img 
                        src={ride.profiles.avatar_url} 
                        alt={ride.profiles.full_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{ride.profiles.full_name}</span>
                      {ride.profiles.phone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => window.open(`tel:${ride.profiles?.phone}`)}
                        >
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
                      {/* Chat Button */}
                      {shouldEnableChat && user && (
                        <ChatButton
                          unreadCount={unreadCount}
                          onClick={() => setChatDialogOpen(true)}
                        />
                      )}
                    </div>
                    
                    {ride.driver_details && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Car className="w-3 h-3" />
                        <span>
                          {ride.driver_details.vehicle_brand} {ride.driver_details.vehicle_model}
                          {ride.driver_details.vehicle_color && ` • ${ride.driver_details.vehicle_color}`}
                          {ride.driver_details.vehicle_plate && ` • ${ride.driver_details.vehicle_plate}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Driver Tracking Button - Always visible when canTrackDriver is true */}
                {canTrackDriver && (
                  <div className="mt-2.5 pt-2.5 border-t border-border/30">
                    <Button
                      onClick={() => setTrackingDialogOpen(true)}
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs border-primary/30 hover:bg-primary/5"
                    >
                      <Map className="w-3 h-3 mr-2" />
                      Rastrear Mototaxista
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Driver Tracking Dialog */}
      {canTrackDriver && (
        <DriverTrackingDialog
          isOpen={trackingDialogOpen}
          onClose={() => setTrackingDialogOpen(false)}
          driverId={ride.driver_id!}
          driverName={ride.profiles?.full_name || 'Mototaxista'}
          pickupLocation={{
            lat: ride.origin_lat,
            lng: ride.origin_lng
          }}
          pickupAddress={ride.origin_address}
          destinationLocation={{
            lat: ride.destination_lat,
            lng: ride.destination_lng
          }}
          destinationAddress={ride.destination_address}
          rideStatus={ride.status}
          driverEnRoute={ride.driver_en_route}
          driverArrived={ride.driver_arrived}
        />
      )}

      {/* Chat Dialog */}
      {shouldEnableChat && user && ride.profiles && (
        <ChatDialog
          isOpen={chatDialogOpen}
          onClose={() => setChatDialogOpen(false)}
          rideId={ride.id}
          receiver={{
            id: ride.driver_id!,
            full_name: ride.profiles.full_name,
            avatar_url: ride.profiles.avatar_url
          }}
          currentUserId={user.id}
        />
      )}
    </>
  );
};
