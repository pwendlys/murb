
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Navigation, Clock, Star } from 'lucide-react';

interface DriverStats {
  totalRides: number;
  totalEarnings: number;
  totalDistance: number;
  totalTime: number;
  averageRating: number;
}

export const DriverStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DriverStats>({
    totalRides: 0,
    totalEarnings: 0,
    totalDistance: 0,
    totalTime: 0,
    averageRating: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    try {
      // Fetch completed rides to calculate gross earnings
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .eq('status', 'completed');

      if (ridesError) throw ridesError;

      // Calculate gross earnings from rides
      const grossEarnings = rides?.reduce((acc, ride) => {
        return acc + (ride.actual_price || ride.estimated_price || 0);
      }, 0) || 0;

      // Fetch paid withdrawals to subtract from total earnings
      const { data: paidWithdrawals, error: withdrawalsError } = await supabase
        .from('driver_payout_requests')
        .select('amount')
        .eq('driver_id', user.id)
        .eq('status', 'paid');

      if (withdrawalsError) throw withdrawalsError;

      // Calculate total paid withdrawals
      const totalPaidWithdrawals = paidWithdrawals?.reduce((sum, withdrawal) => {
        return sum + Number(withdrawal.amount);
      }, 0) || 0;

      // Net earnings = gross earnings - paid withdrawals
      const netEarnings = Math.max(0, grossEarnings - totalPaidWithdrawals);

      // Fetch driver ratings to calculate real average rating
      const { data: ratings, error: ratingsError } = await supabase
        .from('ride_ratings')
        .select('rating')
        .eq('reviewee_id', user.id);

      if (ratingsError) throw ratingsError;

      // Calculate real average rating
      let averageRating = 0;
      if (ratings && ratings.length > 0) {
        const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
        averageRating = totalRating / ratings.length;
      }

      const calculatedStats = rides?.reduce((acc, ride) => {
        return {
          totalRides: acc.totalRides + 1,
          totalEarnings: netEarnings, // Use net earnings instead of gross
          totalDistance: acc.totalDistance + (ride.estimated_distance || 0),
          totalTime: acc.totalTime + (ride.estimated_duration || 0),
          averageRating: averageRating // Use real calculated rating
        };
      }, {
        totalRides: 0,
        totalEarnings: netEarnings,
        totalDistance: 0,
        totalTime: 0,
        averageRating: averageRating // Use real calculated rating
      }) || {
        totalRides: 0,
        totalEarnings: netEarnings,
        totalDistance: 0,
        totalTime: 0,
        averageRating: averageRating // Use real calculated rating
      };

      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-12 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="shadow-ride-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            Ganhos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(stats.totalEarnings)}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-ride-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Navigation className="w-4 h-4 text-blue-600" />
            Corridas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">
            {stats.totalRides}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-ride-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            Tempo Total
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">
            {formatTime(stats.totalTime)}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-ride-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-600" />
            Avaliação
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-primary">
            {stats.averageRating.toFixed(1)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
