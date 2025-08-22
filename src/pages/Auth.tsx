import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthForm } from '@/components/auth/AuthForm';
import { AdminAuth } from '@/components/auth/AdminAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Auth = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userType = searchParams.get('type');
  const isAdmin = searchParams.get('admin') === 'true';

  // Redirect if already authenticated
  useEffect(() => {
    if (user && profile) {
      if (profile.user_type === 'driver') {
        navigate('/driver/map', { replace: true });
      } else if (profile.user_type === 'passenger') {
        navigate('/map', { replace: true });
      } else if (profile.user_type === 'admin') {
        navigate('/admin', { replace: true });
      }
    }
  }, [user, profile, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (user && profile) {
    return null; // Will redirect via useEffect
  }

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
          </div>
          <AdminAuth />
        </div>
      </div>
    );
  }

  if (!userType) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-primary">Viaja+</span>
            </div>
            <CardTitle>Como você quer usar o Viaja+?</CardTitle>
            <CardDescription>
              Escolha sua opção para continuar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/auth?type=passenger" className="block">
              <Button className="w-full h-12 text-lg" size="lg">
                Sou Passageiro
              </Button>
            </Link>
            <Link to="/auth?type=driver" className="block">
              <Button variant="outline" className="w-full h-12 text-lg" size="lg">
                Sou Mototaxista
              </Button>
            </Link>
            <div className="pt-4 border-t">
              <Link to="/auth?admin=true" className="block">
                <Button variant="ghost" className="w-full text-sm text-muted-foreground">
                  Acesso Administrativo
                </Button>
              </Link>
            </div>
            <div className="pt-2">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao início
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Link to="/auth">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
        <AuthForm defaultUserType={userType as 'passenger' | 'driver'} />
      </div>
    </div>
  );
};

export default Auth;