import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const DriverEarningsSimple = () => {
  const { user } = useAuth();
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTotalEarnings();
    }
  }, [user]);

  const fetchTotalEarnings = async () => {
    if (!user) return;

    try {
      // Buscar corridas completadas
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('actual_price, estimated_price')
        .eq('driver_id', user.id)
        .eq('status', 'completed');

      if (ridesError) throw ridesError;

      // Calcular ganhos totais históricos
      const total = rides?.reduce((sum, ride) => {
        const price = ride.actual_price || ride.estimated_price || 0;
        return sum + Number(price);
      }, 0) || 0;

      setTotalEarnings(total);
    } catch (error) {
      console.error('Erro ao buscar ganhos:', error);
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total de Ganhos</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">
          {formatCurrency(totalEarnings)}
        </div>
        <p className="text-xs text-muted-foreground">
          Ganhos históricos de todas as corridas
        </p>
      </CardContent>
    </Card>
  );
};