import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthSelector } from '@/components/auth/AuthSelector';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverEarnings } from '@/components/driver/DriverEarnings';

export const DriverEarningsPage = () => {
  const { user, loading } = useAuth();

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Ganhos - RideBuddy Driver';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Gerencie seus ganhos, visualize saldo disponível e solicite saques como motorista.');
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
    return <AuthSelector />;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Ganhos</h1>
          <p className="text-muted-foreground">
            Gerencie seus ganhos e solicite saques
          </p>
        </header>

        <DriverEarnings />
      </main>

      <DriverBottomNavigation />
    </div>
  );
};