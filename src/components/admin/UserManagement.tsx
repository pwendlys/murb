
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Profile, UserType } from '@/types';
import { Badge } from '@/components/ui/badge';

interface DriverDetails {
  user_id: string;
  driver_license: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_plate: string;
  vehicle_color: string;
  vehicle_type: 'car' | 'moto';
}

interface CombinedUser extends Profile {
  driver_details?: DriverDetails | null;
}

const UserManagement = () => {
  const [users, setUsers] = useState<CombinedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<'all' | UserType>('all');
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    console.log('Fetching users and driver details...');
    
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone, user_type, avatar_url, is_active, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        toast.error('Erro ao carregar usuários');
        setLoading(false);
        return;
      }

      const profiles: Profile[] = (profilesData || []).map((u: any) => ({ 
        ...u, 
        user_type: u.user_type as UserType 
      }));

      // Get driver IDs
      const driverIds = profiles
        .filter(p => p.user_type === 'driver')
        .map(p => p.id);

      let driverDetailsMap: { [key: string]: DriverDetails } = {};

      // Fetch driver details if there are drivers
      if (driverIds.length > 0) {
        console.log('Fetching driver details for IDs:', driverIds);
        
        const { data: driverDetailsData, error: driverDetailsError } = await supabase
          .from('driver_details')
          .select('user_id, driver_license, vehicle_brand, vehicle_model, vehicle_plate, vehicle_color, vehicle_type')
          .in('user_id', driverIds);

        if (driverDetailsError) {
          console.error('Error loading driver details:', driverDetailsError);
          // Don't show error to user for driver details as it's not critical
        } else if (driverDetailsData) {
          console.log('Driver details loaded:', driverDetailsData);
          driverDetailsMap = driverDetailsData.reduce((acc: { [key: string]: DriverDetails }, detail: DriverDetails) => {
            acc[detail.user_id] = detail;
            return acc;
          }, {});
        }
      }

      // Combine profiles with driver details
      const combinedUsers: CombinedUser[] = profiles.map(profile => ({
        ...profile,
        driver_details: profile.user_type === 'driver' ? (driverDetailsMap[profile.id] || null) : undefined
      }));

      console.log('Combined users data:', combinedUsers);
      setUsers(combinedUsers);
    } catch (error) {
      console.error('Unexpected error fetching users:', error);
      toast.error('Erro inesperado ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' ? true : u.user_type === roleFilter;
      const matchesSearch = search.length < 2 || (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search));
      return matchesRole && matchesSearch;
    });
  }, [users, roleFilter, search]);

  const updateUser = async (id: string, patch: Partial<Profile>) => {
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id);
      if (error) {
        console.error('Error updating user:', error);
        toast.error('Falha ao atualizar usuário');
      } else {
        toast.success('Usuário atualizado');
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
      }
    } catch (error) {
      console.error('Unexpected error updating user:', error);
      toast.error('Erro inesperado ao atualizar usuário');
    }
  };

  return (
    <Card className="border-0">
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Filtro por papel</Label>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="passenger">Passageiros</SelectItem>
                <SelectItem value="driver">Mototaxistas</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Buscar (nome ou ID)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite pelo menos 2 caracteres..." />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filtered.map((u) => (
              <div key={u.id} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{u.full_name}</div>
                      {u.user_type === 'driver' && !u.is_active ? (
                        <Badge variant="secondary" className="text-xs">Pendente Aprovação</Badge>
                      ) : u.user_type === 'driver' && u.is_active ? (
                        <Badge variant="default" className="text-xs bg-green-600">Aprovado</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{u.id}</div>
                    
                    {/* Driver details section */}
                    {u.user_type === 'driver' && (
                      <div className="text-xs text-muted-foreground mt-2 p-2 bg-gray-50 rounded">
                        {u.driver_details ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                            <div><strong>CNH:</strong> {u.driver_details.driver_license || 'Não informado'}</div>
                            <div><strong>Placa:</strong> {u.driver_details.vehicle_plate || 'Não informado'}</div>
                            <div><strong>Veículo:</strong> {u.driver_details.vehicle_brand} {u.driver_details.vehicle_model}</div>
                            <div><strong>Cor:</strong> {u.driver_details.vehicle_color} | <strong>Tipo:</strong> {u.driver_details.vehicle_type === 'car' ? 'Carro' : 'Moto'}</div>
                          </div>
                        ) : (
                          <span className="italic text-orange-600">⚠️ Aguardando dados do mototaxista</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={u.user_type} onValueChange={(v) => updateUser(u.id, { user_type: v as UserType })}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passenger">passenger</SelectItem>
                          <SelectItem value="driver">driver</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={(v) => updateUser(u.id, { is_active: v })}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                          className={u.is_active ? 'border-red-200 hover:bg-red-50' : 'border-green-200 hover:bg-green-50'}
                        >
                          {u.is_active ? 'Desativar' : 'Aprovar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserManagement;
