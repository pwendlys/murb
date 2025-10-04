
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LogOut } from 'lucide-react';
import PricingSettingsForm from '@/components/admin/PricingSettingsForm';
import UserManagement from '@/components/admin/UserManagement';
import RideHistory from '@/components/admin/RideHistory';
import EarningsHistory from '@/components/admin/EarningsHistory';
import { SubscriptionDashboard } from '@/components/admin/SubscriptionDashboard';
import { SubscriptionManagement } from '@/components/admin/SubscriptionManagement';
import { ServicePricingManager } from '@/components/admin/ServicePricingManager';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

const Admin = () => {
  const { profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const flags = useFeatureFlags();

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

  const handleLogout = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-start mb-6">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-primary">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie preços, usuários, corridas, ganhos e assinaturas</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>

      <Card className="shadow-ride-card border-0">
        <CardHeader>
          <CardTitle>Administração</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="settings">
            <TabsList className={`grid w-full ${flags.adminServicePricing ? 'grid-cols-7' : 'grid-cols-6'}`}>
              <TabsTrigger value="settings">Configurações de Preço</TabsTrigger>
              {flags.adminServicePricing && (
                <TabsTrigger value="service-pricing">Preços por Serviço</TabsTrigger>
              )}
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="rides">Histórico de Corridas</TabsTrigger>
              <TabsTrigger value="earnings">Histórico de Ganhos</TabsTrigger>
              <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard de Assinaturas</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="pt-4">
              <PricingSettingsForm />
            </TabsContent>

            {flags.adminServicePricing && (
              <TabsContent value="service-pricing" className="pt-4">
                <ServicePricingManager />
              </TabsContent>
            )}

            <TabsContent value="users" className="pt-4">
              <UserManagement />
            </TabsContent>

            <TabsContent value="rides" className="pt-4">
              <RideHistory />
            </TabsContent>

            <TabsContent value="earnings" className="pt-4">
              <EarningsHistory />
            </TabsContent>

            <TabsContent value="subscriptions" className="pt-4">
              <SubscriptionManagement />
            </TabsContent>

            <TabsContent value="dashboard" className="pt-4">
              <SubscriptionDashboard />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
