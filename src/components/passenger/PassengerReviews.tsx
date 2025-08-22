import React, { useState, useEffect } from "react";
import { Star, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriverPassengerRating {
  id: string;
  ride_id: string;
  driver_id: string;
  passenger_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rides?: {
    origin_address: string;
    destination_address: string;
    profiles?: {
      full_name: string;
    };
  };
}

export const PassengerReviews: React.FC = () => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState<DriverPassengerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    if (user) {
      fetchRatings();
    }
  }, [user]);

  const fetchRatings = async () => {
    if (!user) return;

    try {
      // Fetch ratings with driver info
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("driver_passenger_ratings")
        .select("*")
        .eq("passenger_id", user.id)
        .order("created_at", { ascending: false });

      if (ratingsError) throw ratingsError;

      // Fetch ride details for each rating
      const ratingsWithRides = await Promise.all(
        (ratingsData || []).map(async (rating) => {
          const { data: rideData } = await supabase
            .from("rides")
            .select("origin_address, destination_address")
            .eq("id", rating.ride_id)
            .single();

          // Fetch driver profile
          const { data: driverProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", rating.driver_id)
            .single();

          return {
            ...rating,
            rides: rideData ? {
              ...rideData,
              profiles: driverProfile
            } : null
          };
        })
      );

      setRatings(ratingsWithRides);
      
      if (ratingsWithRides && ratingsWithRides.length > 0) {
        const avg = ratingsWithRides.reduce((sum, rating) => sum + rating.rating, 0) / ratingsWithRides.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }
    } catch (error) {
      console.error("Erro ao buscar avaliações:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating ? "fill-primary text-primary" : "text-muted-foreground"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo das Avaliações */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resumo das Avaliações</span>
              <Badge variant="secondary">
                {ratings.length} avaliação{ratings.length !== 1 ? "ões" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="flex">{renderStars(Math.round(averageRating))}</div>
              <span className="text-lg font-semibold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">de 5.0</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Avaliações */}
      <div className="space-y-4">
        {ratings.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma avaliação ainda</h3>
              <p className="text-muted-foreground">
                Você ainda não recebeu avaliações de motoristas.
              </p>
            </CardContent>
          </Card>
        ) : (
          ratings.map((rating) => (
            <Card key={rating.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {rating.rides?.profiles?.full_name || "Motorista"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(rating.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1">
                    {renderStars(rating.rating)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <p><strong>Corrida:</strong> {rating.rides?.origin_address} → {rating.rides?.destination_address}</p>
                </div>
                {rating.comment && (
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm">{rating.comment}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};