
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PersonalDataForm from '@/components/profile/PersonalDataForm';
import DriverDetailsForm from '@/components/driver/DriverDetailsForm';
import BottomNavigation from '@/components/layout/BottomNavigation';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';

const Profile = () => {
  const { user, profile, loading, refreshProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Meu Perfil</h1>
            <p className="text-muted-foreground">
              Gerencie suas informações pessoais e configurações da conta
            </p>
          </div>

          <div className="space-y-6">
            <PersonalDataForm 
              profile={profile} 
              onProfileUpdated={refreshProfile}
            />

            {profile.user_type === 'driver' && (
              <Card>
                <CardHeader>
                  <CardTitle>Dados do Motorista e Veículo</CardTitle>
                </CardHeader>
                <CardContent>
                  <DriverDetailsForm 
                    userId={profile.id}
                    onSubmitted={refreshProfile}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      {/* Show appropriate navigation based on user type */}
      {profile?.user_type === 'driver' ? (
        <DriverBottomNavigation />
      ) : (
        <BottomNavigation />
      )}
    </div>
  );
};

export default Profile;
