import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Clock, Navigation } from "lucide-react";
import { Ride } from "@/types";
import { RatePassengerDialog } from "@/components/passenger/RatePassengerDialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriverCompletedRideCardProps {
  ride: Ride;
  onRatingSubmitted?: () => void;
}

export const DriverCompletedRideCard: React.FC<DriverCompletedRideCardProps> = ({
  ride,
  onRatingSubmitted
}) => {
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  React.useEffect(() => {
    checkIfAlreadyRated();
  }, [ride.id]);

  const checkIfAlreadyRated = async () => {
    try {
      const { data, error } = await supabase
        .from("driver_passenger_ratings")
        .select("id")
        .eq("ride_id", ride.id)
        .eq("driver_id", ride.driver_id)
        .eq("passenger_id", ride.passenger_id)
        .single();

      if (data) {
        setHasRated(true);
      }
    } catch (error) {
      // Rating doesn't exist, which is expected
      setHasRated(false);
    }
  };

  const handleRatingSubmitted = () => {
    setHasRated(true);
    onRatingSubmitted?.();
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">Corrida Concluída</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(new Date(ride.completed_at!), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Finalizada</Badge>
              {ride.actual_price && (
                <span className="font-semibold text-primary text-lg">
                  R$ {ride.actual_price.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Informações do Passageiro */}
          {ride.profiles && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
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
                <p className="font-medium text-sm">Passageiro</p>
                <p className="text-sm text-muted-foreground">{ride.profiles?.full_name}</p>
              </div>
            </div>
          )}

          {/* Detalhes da Corrida */}
          <div className="space-y-2">
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

          {/* Botão de Avaliação */}
          {!hasRated ? (
            <Button
              onClick={() => setShowRatingDialog(true)}
              className="w-full"
              variant="outline"
            >
              <Star className="w-4 h-4 mr-2" />
              Avaliar Passageiro
            </Button>
          ) : (
            <div className="text-center py-2 text-sm text-muted-foreground">
              ✓ Passageiro avaliado
            </div>
          )}
        </CardContent>
      </Card>

      <RatePassengerDialog
        ride={ride}
        open={showRatingDialog}
        onOpenChange={setShowRatingDialog}
        onSubmitted={handleRatingSubmitted}
      />
    </>
  );
};