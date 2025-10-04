import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useServicePricing } from '@/hooks/useServicePricing';
import { ServicePricingEditModal } from './ServicePricingEditModal';
import type { PricingSettings } from '@/hooks/usePricingSettings';
import type { ServiceType } from '@/types';
import { Bike, Car, Package, Truck } from 'lucide-react';

const SERVICE_TYPE_CONFIG: Record<
  ServiceType,
  { label: string; icon: typeof Bike; color: string }
> = {
  moto_taxi: { label: 'Moto Táxi', icon: Bike, color: 'text-blue-600' },
  passenger_car: { label: 'Carro Passageiro', icon: Car, color: 'text-green-600' },
  delivery_bike: { label: 'Moto Flash', icon: Package, color: 'text-orange-600' },
  delivery_car: { label: 'Car Flash', icon: Truck, color: 'text-purple-600' },
};

export const ServicePricingManager = () => {
  const { allSettings, loading, updateSettings } = useServicePricing();
  const [editingSettings, setEditingSettings] = useState<PricingSettings | null>(null);

  if (loading) {
    return <div className="text-center py-8">Carregando preços...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {allSettings.map((settings) => {
          const config = SERVICE_TYPE_CONFIG[settings.service_type];
          const Icon = config.icon;

          return (
            <Card key={settings.service_type}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  {config.label}
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
