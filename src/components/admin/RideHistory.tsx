
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Ride, RideStatus } from '@/types';

interface RideWithProfiles extends Omit<Ride, 'status'> {
  status: RideStatus;
  passenger_profile?: {
    full_name: string;
  };
  driver_profile?: {
    full_name: string;
  };
}

const RideHistory = () => {
  const [rides, setRides] = useState<RideWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | RideStatus>('all');
  const [search, setSearch] = useState('');

  const fetchRides = async () => {
    setLoading(true);
    const sb = supabase as any;
    
    // Fetch rides first
    const { data: ridesData, error: ridesError } = await sb
      .from('rides')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

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
    ridesData.forEach((ride: any) => {
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
      profilesData.forEach((profile: any) => {
        profilesMap.set(profile.id, { full_name: profile.full_name });
      });
    }

    // Combine rides with profiles and properly type the status
    const ridesWithProfiles: RideWithProfiles[] = (ridesData as any[]).map((ride: any) => ({
      ...ride,
      status: ride.status as RideStatus,
      passenger_profile: profilesMap.get(ride.passenger_id),
      driver_profile: ride.driver_id ? profilesMap.get(ride.driver_id) : undefined
    }));

    setRides(ridesWithProfiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const filtered = useMemo(() => {
    return rides.filter((r) => {
      const matchesStatus = statusFilter === 'all' ? true : r.status === statusFilter;
      const matchesSearch =
        search.length < 2 ||
        r.origin_address?.toLowerCase().includes(search.toLowerCase()) ||
        r.destination_address?.toLowerCase().includes(search.toLowerCase()) ||
        r.passenger_profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.driver_profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.id.includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [rides, statusFilter, search]);

  const updateRide = async (id: string, patch: Partial<Ride>) => {
    const sb = supabase as any;
    const { error } = await sb.from('rides').update(patch).eq('id', id);
    if (error) {
      console.error('Error updating ride:', error);
      toast.error('Falha ao atualizar corrida');
    } else {
      toast.success('Corrida atualizada');
      setRides((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
  };

  return (
    <Card className="border-0">
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="accepted">Aceita</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="completed">Finalizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Buscar por endereço, nome do passageiro, motorista ou ID (mín. 2 caracteres)" 
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma corrida encontrada</div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 grid md:grid-cols-6 gap-3 items-center">
                <div className="md:col-span-2 min-w-0">
                  <div className="text-sm font-medium truncate">De: {r.origin_address}</div>
                  <div className="text-sm truncate">Para: {r.destination_address}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <div className="text-sm">
                  <div className="font-medium text-blue-600">
                    Passageiro: {r.passenger_profile?.full_name || 'N/A'}
                  </div>
                  <div className="font-medium text-green-600">
                    Motorista: {r.driver_profile?.full_name || 'Não atribuído'}
                  </div>
                </div>
                <div className="text-sm">
                  <div>Dist.: {r.estimated_distance ? `${r.estimated_distance} km` : '-'}</div>
                  <div>Tempo: {r.estimated_duration ? `${r.estimated_duration} min` : '-'}</div>
                </div>
                <div className="text-sm">
                  <div>Preço: {r.estimated_price !== null ? `R$ ${r.estimated_price.toFixed(2)}` : '-'}</div>
                  <div>Status: {r.status}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={r.status} onValueChange={(v) => updateRide(r.id, { status: v as RideStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">pending</SelectItem>
                      <SelectItem value="accepted">accepted</SelectItem>
                      <SelectItem value="in_progress">in_progress</SelectItem>
                      <SelectItem value="completed">completed</SelectItem>
                      <SelectItem value="cancelled">cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => updateRide(r.id, { status: 'cancelled' })}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RideHistory;
