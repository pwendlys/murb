
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Star, MessageCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriverReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  ride_id: string;
  passenger_profile: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export const DriverReviews = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<DriverReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalReviews, setTotalReviews] = useState<number>(0);

  useEffect(() => {
    if (user) {
      fetchReviews();
      
      // Set up real-time subscription for new reviews
      const subscription = supabase
        .channel('driver-reviews')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'ride_ratings',
            filter: `driver_id=eq.${user.id}`
          },
          () => fetchReviews()
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchReviews = async () => {
    if (!user) return;
    
    try {
      // First fetch the reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('ride_ratings')
        .select('*')
        .eq('reviewee_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      if (!reviewsData || reviewsData.length === 0) {
        setReviews([]);
        setTotalReviews(0);
        setAverageRating(0);
        setLoading(false);
        return;
      }

      // Get unique reviewer IDs (passengers who reviewed the driver)
      const reviewerIds = [...new Set(reviewsData.map(review => review.reviewer_id))];
      
      // Fetch passenger profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', reviewerIds);

      if (profilesError) throw profilesError;

      // Create a map of passenger profiles
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Combine reviews with passenger profiles
      const processedReviews: DriverReview[] = reviewsData.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        ride_id: review.ride_id,
        passenger_profile: profilesMap.get(review.reviewer_id) || null
      }));

      setReviews(processedReviews);
      setTotalReviews(processedReviews.length);
      
      // Calculate average rating
      if (processedReviews.length > 0) {
        const sum = processedReviews.reduce((acc, review) => acc + review.rating, 0);
        setAverageRating(sum / processedReviews.length);
      } else {
        setAverageRating(0);
      }
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      toast.error('Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`${size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'} ${
          index < rating 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando avaliações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card className="shadow-ride-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Resumo das Avaliações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {averageRating > 0 ? averageRating.toFixed(1) : '0.0'}
              </div>
              <div className="flex justify-center mb-2">
                {renderStars(Math.round(averageRating), 'lg')}
              </div>
              <p className="text-sm text-muted-foreground">Avaliação Média</p>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {totalReviews}
              </div>
              <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Total de Avaliações</p>
            </div>

            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {totalReviews > 0 ? Math.round((reviews.filter(r => r.rating >= 4).length / totalReviews) * 100) : 0}%
              </div>
              <div className="flex justify-center mb-2">
                <Star className="w-8 h-8 fill-yellow-400 text-yellow-400" />
              </div>
              <p className="text-sm text-muted-foreground">Avaliações Positivas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card className="shadow-ride-card border-0">
        <CardHeader>
          <CardTitle>Todas as Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma avaliação recebida ainda</p>
              <p className="text-sm text-muted-foreground mt-2">
                Complete mais corridas para receber avaliações dos passageiros
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {review.passenger_profile?.avatar_url ? (
                          <img
                            src={review.passenger_profile.avatar_url}
                            alt={review.passenger_profile.full_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-primary font-semibold text-sm">
                            {review.passenger_profile?.full_name?.charAt(0) || 'P'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {review.passenger_profile?.full_name || 'Passageiro'}
                        </p>
                        <div className="flex items-center gap-1">
                          {renderStars(review.rating)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(review.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </div>
                  
                  {review.comment && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-foreground">{review.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
