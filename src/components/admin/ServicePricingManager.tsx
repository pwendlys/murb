import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServicePricing } from '@/hooks/useServicePricing';
import { ServicePricingEditModal } from './ServicePricingEditModal';
import type { PricingSettings } from '@/hooks/usePricingSettings';
import { SERVICE_METADATA } from '@/lib/serviceMetadata';
import { logTelemetry } from '@/lib/telemetry';

export const ServicePricingManager = () => {
  const { allSettings, loading, updateSettings } = useServicePricing();
  const [editingSettings, setEditingSettings] = useState<PricingSettings | null>(null);

  useEffect(() => {
    if (!loading && allSettings.length > 0) {
      allSettings.forEach((settings) => {
        logTelemetry({
          event: 'pricing_viewed',
          data: { service_type: settings.service_type },
        });
      });
    }
  }, [loading, allSettings]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (allSettings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Nenhuma configuração de preço encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {allSettings.map((settings) => {
          const metadata = SERVICE_METADATA[settings.service_type];
          const Icon = metadata.icon;

          return (
            <Card key={settings.service_type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${metadata.color}`} />
                  {metadata.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  {settings.price_per_km_active && (
                    <div>
                      <span className="font-medium">Preço/km:</span> R$ {settings.price_per_km.toFixed(2)}
                    </div>
                  )}
                  {settings.fixed_price_active && settings.fixed_price !== null && (
                    <div>
                      <span className="font-medium">Preço fixo:</span> R$ {settings.fixed_price.toFixed(2)}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Taxa:</span>{' '}
                    {settings.service_fee_type === 'fixed'
                      ? `R$ ${settings.service_fee_value.toFixed(2)}`
                      : `${settings.service_fee_value.toFixed(2)}%`}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setEditingSettings(settings)}
                >
                  Editar Preços
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editingSettings && (
        <ServicePricingEditModal
          open={!!editingSettings}
          onOpenChange={(open) => !open && setEditingSettings(null)}
          settings={editingSettings}
          onSave={updateSettings}
        />
      )}
    </div>
  );
};
