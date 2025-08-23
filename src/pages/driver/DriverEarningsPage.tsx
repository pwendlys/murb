import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthSelector } from '@/components/auth/AuthSelector';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DriverBottomNavigation } from '@/components/layout/DriverBottomNavigation';
import { DriverFeePayments } from '@/components/driver/DriverFeePayments';

export const DriverEarningsPage = () => {
  const { user, loading } = useAuth();

  // SEO Meta tags
  useEffect(() => {
    document.title = 'Pagamento de Taxas - RideBuddy Mototaxista';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Gerencie pagamento de taxas, visualize saldos e prazos como mototaxista.');
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
          <h1 className="text-2xl font-bold text-foreground mb-2">Pagamento de Taxas</h1>
          <p className="text-muted-foreground">
            Gerencie suas obrigações de pagamento de taxa
          </p>
        </header>

        <DriverFeePayments />
      </main>

      <DriverBottomNavigation />
    </div>
  );
};