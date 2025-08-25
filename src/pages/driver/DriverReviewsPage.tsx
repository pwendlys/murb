import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverReviews } from '@/components/driver/DriverReviews';
import { useAccessControl } from '@/hooks/useAccessControl';
import { AccessBlockedScreen } from '@/components/driver/AccessBlockedScreen';

export const DriverReviewsPage = () => {
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();
  const { hasActiveAccess, subscriptionLoading } = useAccessControl();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Avaliações - RideBuddy Mototaxista';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Visualize suas avaliações e comentários recebidos dos passageiros.');
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', window.location.origin + '/driver/reviews');
    }

    return () => {
      document.title = 'RideBuddy';
    };
  }, []);

  if (loading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Verificar se é motorista e se tem acesso
  if (profile?.user_type === 'driver' && !hasActiveAccess) {
    return <AccessBlockedScreen />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Avaliações</h1>
          <p className="text-muted-foreground">
            Suas avaliações e comentários dos passageiros
          </p>
        </header>

        <DriverReviews />
      </main>

      <DriverBottomNavigation />
    </div>
  );
};