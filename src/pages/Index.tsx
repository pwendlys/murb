
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingPage } from '@/components/landing/LandingPage';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users based on their type
  useEffect(() => {
    if (user && profile) {
      if (profile.user_type === 'driver') {
        navigate('/driver/map', { replace: true });
      } else if (profile.user_type === 'passenger') {
        navigate('/map', { replace: true });
      } else if (profile.user_type === 'admin') {
        const adminSecretPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
        navigate(`${adminSecretPath}/painel`, { replace: true });
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

  // Show landing page for non-authenticated users
  if (!user || !profile) {
    return <LandingPage />;
  }

  // This will not render as users are redirected in useEffect
  return null;
};

export default Index;
