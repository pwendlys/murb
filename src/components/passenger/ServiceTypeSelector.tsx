import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ServiceType } from '@/types';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { SERVICE_METADATA, getServiceMetadata } from '@/lib/serviceMetadata';
import { logTelemetry } from '@/lib/telemetry';
import { formatCurrency } from '@/utils/currency';
import { useAvailability } from '@/hooks/useAvailability';
import { useEffect } from 'react';

interface ServiceTypeSelectorProps {
  value: ServiceType;
  onChange: (type: ServiceType) => void;
  estimatedPrices?: Record<ServiceType, number | null>;
  loading?: boolean;
  region?: string;
}

export const ServiceTypeSelector = ({ value, onChange, estimatedPrices, loading = false, region = 'juiz_de_fora' }: ServiceTypeSelectorProps) => {
  const flags = useFeatureFlags();
  
  // Fetch availability if flag is enabled
  const { data: availableServices, isLoading: loadingAvailability } = useAvailability(
    region,
    flags.serviceSelectorAvailability ? new Date() : undefined
  );
  
  const availableTypes = availableServices?.map((s) => s.serviceType) || [];

  const visibleOptions = Object.values(SERVICE_METADATA).filter((option) => {
    if (option.type === 'moto_taxi') return true;
    if (option.type === 'passenger_car') return flags.passengerCar;
    if (option.type === 'delivery_bike' || option.type === 'delivery_car') return flags.deliveryServices;
    return false;
  });

  if (visibleOptions.length <= 1) return null;
  
  // Log filtered count when availability changes
  useEffect(() => {
    if (flags.serviceSelectorAvailability && availableServices) {
      const filteredCount = visibleOptions.length - availableTypes.length;
      logTelemetry({
        event: 'service_filtered_count',
        data: { 
          filtered_count: filteredCount, 
          available_count: availableTypes.length,
          region 
        },
      });
    }
  }, [availableServices, flags.serviceSelectorAvailability, region]);

  const handleChange = (type: ServiceType, isAvailable: boolean) => {
    if (!isAvailable) {
      logTelemetry({
        event: 'service_unavailable_click',
        data: { service_type: type, reason: 'Indisponível nesta região/horário' },
      });
      return;
    }
    
    onChange(type);
    logTelemetry({
      event: 'service_type_selected',
      data: { service_type: type, context: 'ride_request', available: isAvailable },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <label className="text-sm font-medium">Tipo de Serviço</label>
        {loadingAvailability && flags.serviceSelectorAvailability ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {visibleOptions.map((metadata) => {
              const Icon = metadata.icon;
              const isActive = value === metadata.type;
              const estimatedPrice = estimatedPrices?.[metadata.type];
              const isAvailable = !flags.serviceSelectorAvailability || availableTypes.includes(metadata.type);
              const unavailableReason = !isAvailable ? 'Indisponível nesta região/horário' : '';

              const cardContent = (
                <Card
                  key={metadata.type}
                  role="button"
                  tabIndex={0}
                  aria-label={`${metadata.label}: ${metadata.description}${estimatedPrice ? `, preço estimado ${formatCurrency(estimatedPrice)}` : ''}${!isAvailable ? ' - Indisponível' : ''}`}
                  aria-pressed={isActive}
                  aria-disabled={!isAvailable}
                  className={`p-3 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    !isAvailable 
                      ? 'opacity-50 cursor-not-allowed bg-muted' 
                      : isActive 
                        ? `${metadata.activeClass} cursor-pointer` 
                        : `${metadata.bgClass} ${metadata.borderClass} ${metadata.hoverClass} cursor-pointer`
                  }`}
                  onClick={() => handleChange(metadata.type, isAvailable)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleChange(metadata.type, isAvailable);
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

              if (!isAvailable && unavailableReason) {
                return (
                  <Tooltip key={metadata.type}>
                    <TooltipTrigger asChild>
                      {cardContent}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{unavailableReason}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return cardContent;
            })}
          </div>
        )}
        {flags.serviceSelectorAvailability && availableTypes.length === 0 && !loadingAvailability && (
          <p className="text-sm text-muted-foreground text-center py-2" role="alert" aria-live="polite">
            Nenhum serviço disponível no momento para esta região/horário.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
};
