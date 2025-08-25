import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverEarningsSimple } from '@/components/driver/DriverEarningsSimple';
import { DriverSubscriptions } from '@/components/driver/DriverSubscriptions';

export const DriverEarningsPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Ganhos e Assinatura - RideBuddy Mototaxista';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Gerencie seus ganhos e assinatura como mototaxista no RideBuddy.');
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', window.location.origin + '/driver/earnings');
    }

    return () => {
      document.title = 'RideBuddy';
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Ganhos/Assinatura</h1>
          <p className="text-muted-foreground">
            Acompanhe seus ganhos e gerencie sua assinatura
          </p>
        </header>

        <div className="space-y-6">
          <DriverEarningsSimple />
          <DriverSubscriptions />
        </div>
      </main>

      <DriverBottomNavigation />
    </div>
  );
};