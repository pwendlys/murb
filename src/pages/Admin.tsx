
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';
import UserManagement from '@/components/admin/UserManagement';
import RideHistory from '@/components/admin/RideHistory';
import EarningsHistory from '@/components/admin/EarningsHistory';
import WithdrawalManagement from '@/components/admin/WithdrawalManagement';

const Admin = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!profile || profile.user_type !== 'admin') {
        navigate('/', { replace: true });
      }
    }
  }, [profile, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile || profile.user_type !== 'admin') {
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-primary">Painel Administrativo</h1>
        <p className="text-muted-foreground">Gerencie preços, usuários, corridas e saques</p>
      </div>

      <Card className="shadow-ride-card border-0">
        <CardHeader>
          <CardTitle>Administração</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="settings">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="settings">Configurações de Preço</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="rides">Histórico de Corridas</TabsTrigger>
              <TabsTrigger value="earnings">Histórico de Ganhos</TabsTrigger>
              <TabsTrigger value="withdrawals">Gerenciar Saques</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="pt-4">
              <PricingSettingsForm />
            </TabsContent>

            <TabsContent value="users" className="pt-4">
              <UserManagement />
            </TabsContent>

            <TabsContent value="rides" className="pt-4">
              <RideHistory />
            </TabsContent>

            <TabsContent value="earnings" className="pt-4">
              <EarningsHistory />
            </TabsContent>

            <TabsContent value="withdrawals" className="pt-4">
              <WithdrawalManagement />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
