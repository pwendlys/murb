import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { ServiceType } from '@/types';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { SERVICE_METADATA, getServiceMetadata } from '@/lib/serviceMetadata';
import { logTelemetry } from '@/lib/telemetry';
import { formatCurrency } from '@/utils/currency';

interface ServiceTypeSelectorProps {
  value: ServiceType;
  onChange: (type: ServiceType) => void;
  estimatedPrices?: Record<ServiceType, number | null>;
  loading?: boolean;
}

export const ServiceTypeSelector = ({ value, onChange, estimatedPrices, loading = false }: ServiceTypeSelectorProps) => {
  const flags = useFeatureFlags();

  const visibleOptions = Object.values(SERVICE_METADATA).filter((option) => {
    if (option.type === 'moto_taxi') return true;
    if (option.type === 'passenger_car') return flags.passengerCar;
    if (option.type === 'delivery_bike' || option.type === 'delivery_car') return flags.deliveryServices;
    return false;
  });

  if (visibleOptions.length <= 1) return null;

  const handleChange = (type: ServiceType) => {
    onChange(type);
    logTelemetry({
      event: 'service_type_selected',
      data: { service_type: type, context: 'ride_request' },
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Tipo de Serviço</label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {visibleOptions.map((metadata) => {
          const Icon = metadata.icon;
          const isActive = value === metadata.type;
          const estimatedPrice = estimatedPrices?.[metadata.type];

          return (
            <Card
              key={metadata.type}
              role="button"
              tabIndex={0}
              aria-label={`${metadata.label}: ${metadata.description}${estimatedPrice ? `, preço estimado ${formatCurrency(estimatedPrice)}` : ''}`}
              aria-pressed={isActive}
              className={`p-3 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                isActive ? metadata.activeClass : `${metadata.bgClass} ${metadata.borderClass} ${metadata.hoverClass}`
              }`}
              onClick={() => handleChange(metadata.type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleChange(metadata.type);
                }
              }}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <Icon className={`h-6 w-6 ${isActive ? metadata.colorActive : metadata.color}`} />
                <span className="text-xs font-medium">{metadata.label}</span>
                {loading ? (
                  <LoadingSpinner size="sm" className="mt-1" />
                ) : estimatedPrice !== undefined && estimatedPrice !== null ? (
                  <span className="text-xs text-muted-foreground">{formatCurrency(estimatedPrice)}</span>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
