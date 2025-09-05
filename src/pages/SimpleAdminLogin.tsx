import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SimpleAdminAuth } from '@/components/auth/SimpleAdminAuth';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const SimpleAdminLogin = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const adminSecretPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';

  // Add noindex meta tags for security
  useEffect(() => {
    const metaNoIndex = document.createElement('meta');
    metaNoIndex.name = 'robots';
    metaNoIndex.content = 'noindex, nofollow, noarchive, nosnippet';
    document.head.appendChild(metaNoIndex);

    const metaTitle = document.createElement('title');
    metaTitle.textContent = 'Login Administrativo - Viaja+';
    document.head.appendChild(metaTitle);

    return () => {
      document.head.removeChild(metaNoIndex);
      document.head.removeChild(metaTitle);
    };
  }, []);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (user && profile && profile.user_type === 'admin') {
      navigate(`${adminSecretPath}/painel`, { replace: true });
    }
  }, [user, profile, navigate, adminSecretPath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  if (user && profile && profile.user_type === 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Viaja+</h1>
          <h2 className="text-xl font-semibold text-foreground mb-2">Login Administrativo</h2>
          <p className="text-muted-foreground">Sistema simplificado de acesso ao painel</p>
        </div>
        <SimpleAdminAuth />
      </div>
    </div>
  );
};

export default SimpleAdminLogin;