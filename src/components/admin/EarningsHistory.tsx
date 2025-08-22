
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DollarSign, Navigation, TrendingUp, MapPin } from 'lucide-react';
import { RideStatus } from '@/types';

interface Driver {
  id: string;
  full_name: string;
}

interface EarningsRide {
  id: string;
  passenger_id: string;
  driver_id: string;
  origin_address: string;
  destination_address: string;
  status: RideStatus;
  estimated_distance: number | null;
  estimated_price: number | null;
  actual_price: number | null;
  created_at: string;
  completed_at: string | null;
  passenger_profile?: {
    full_name: string;
  };
  driver_profile?: {
    full_name: string;
  };
}

interface EarningsSummary {
  totalEarnings: number;
  totalRides: number;
  averageEarnings: number;
  totalDistance: number;
}

const EarningsHistory = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [rides, setRides] = useState<EarningsRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const fetchDrivers = async () => {
    const sb = supabase as any;
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name')
      .eq('user_type', 'driver')
      .order('full_name');

    if (error) {
      console.error('Error loading drivers:', error);
      toast.error('Erro ao carregar motoristas');
    } else {
      setDrivers(data || []);
    }
  };

  const fetchEarnings = async () => {
    setLoading(true);
    const sb = supabase as any;

    let query = sb
      .from('rides')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(200);

    // Apply driver filter
    if (selectedDriver !== 'all') {
      query = query.eq('driver_id', selectedDriver);
    }

    // Apply date filters
    if (dateFrom) {
      query = query.gte('completed_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('completed_at', dateTo);
    }

    const { data: ridesData, error: ridesError } = await query;

    if (ridesError) {
      console.error('Error loading rides:', ridesError);
      toast.error('Erro ao carregar corridas');
      setLoading(false);
      return;
    }

    if (!ridesData || ridesData.length === 0) {
      setRides([]);
      setLoading(false);
      return;
    }

    // Fetch all unique user IDs from rides
    const userIds = new Set<string>();
    (ridesData as any[]).forEach((ride: any) => {
      userIds.add(ride.passenger_id);
      if (ride.driver_id) userIds.add(ride.driver_id);
    });

    // Fetch profiles for all users
    const { data: profilesData, error: profilesError } = await sb
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(userIds));

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      toast.error('Erro ao carregar perfis');
    }

    // Create a map of user IDs to profiles
    const profilesMap = new Map<string, { full_name: string }>();
    if (profilesData) {
      (profilesData as any[]).forEach((profile: any) => {
        profilesMap.set(profile.id, { full_name: profile.full_name });
      });
    }

    // Combine rides with profiles and properly type the status
    const ridesWithProfiles: EarningsRide[] = (ridesData as any[]).map((ride: any) => ({
      ...ride,
      status: ride.status as RideStatus,
      passenger_profile: profilesMap.get(ride.passenger_id),
      driver_profile: ride.driver_id ? profilesMap.get(ride.driver_id) : undefined
    }));

    setRides(ridesWithProfiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrivers();
    fetchEarnings();
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [selectedDriver, dateFrom, dateTo]);

  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      const matchesSearch = search.length < 2 || 
        ride.origin_address?.toLowerCase().includes(search.toLowerCase()) ||
        ride.destination_address?.toLowerCase().includes(search.toLowerCase()) ||
        ride.passenger_profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        ride.driver_profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        ride.id.includes(search);
      return matchesSearch;
    });
  }, [rides, search]);

  const summary: EarningsSummary = useMemo(() => {
    return filteredRides.reduce((acc, ride) => {
      const earnings = Number(ride.actual_price) || Number(ride.estimated_price) || 0;
      const distance = Number(ride.estimated_distance) || 0;
      
      return {
        totalEarnings: acc.totalEarnings + earnings,
        totalRides: acc.totalRides + 1,
        averageEarnings: 0, // Will calculate after
        totalDistance: acc.totalDistance + distance
      };
    }, {
      totalEarnings: 0,
      totalRides: 0,
      averageEarnings: 0,
      totalDistance: 0
    });
  }, [filteredRides]);

  summary.averageEarnings = summary.totalRides > 0 ? summary.totalEarnings / summary.totalRides : 0;

  const exportToCSV = () => {
    const headers = ['Data', 'Motorista', 'Passageiro', 'Origem', 'Destino', 'Distância (km)', 'Ganhos (R$)'];
    const csvContent = [
      headers.join(','),
      ...filteredRides.map(ride => [
        new Date(ride.completed_at || ride.created_at).toLocaleDateString('pt-BR'),
        ride.driver_profile?.full_name || 'N/A',
        ride.passenger_profile?.full_name || 'N/A',
        `"${ride.origin_address}"`,
        `"${ride.destination_address}"`,
        ride.estimated_distance || 0,
        (Number(ride.actual_price) || Number(ride.estimated_price) || 0).toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico-ganhos-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <Card className="border-0">
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-4">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os motoristas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motoristas</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Data inicial"
          />
          
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Data final"
          />
          
          <Button onClick={exportToCSV} variant="outline" disabled={filteredRides.length === 0}>
            Exportar CSV
          </Button>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por endereço, nome ou ID (mín. 2 caracteres)"
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-ride-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                Total de Ganhos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-primary">
                R$ {summary.totalEarnings.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-ride-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                Total de Corridas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-primary">
                {summary.totalRides}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-ride-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-600" />
                Ganhos Médios
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-primary">
                R$ {summary.averageEarnings.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-ride-card border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-600" />
                Distância Total
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-primary">
                {summary.totalDistance.toFixed(1)} km
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rides Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredRides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma corrida encontrada para os filtros selecionados
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredRides.map((ride) => {
              const earnings = Number(ride.actual_price) || Number(ride.estimated_price) || 0;
              return (
                <div key={ride.id} className="border rounded-lg p-3 grid md:grid-cols-6 gap-3 items-center">
                  <div className="md:col-span-2 min-w-0">
                    <div className="text-sm font-medium truncate">De: {ride.origin_address}</div>
                    <div className="text-sm truncate">Para: {ride.destination_address}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(ride.completed_at || ride.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-green-600">
                      Motorista: {ride.driver_profile?.full_name || 'N/A'}
                    </div>
                    <div className="font-medium text-blue-600">
                      Passageiro: {ride.passenger_profile?.full_name || 'N/A'}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div>Dist.: {ride.estimated_distance ? `${ride.estimated_distance} km` : '-'}</div>
                    <div>ID: {ride.id.substring(0, 8)}...</div>
                  </div>
                  <div className="text-sm">
                    <div className="font-bold text-green-600">
                      Ganhos: R$ {earnings.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ride.actual_price ? 'Real' : 'Estimado'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Finalizada
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EarningsHistory;
