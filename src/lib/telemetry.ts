import type { ServiceType } from '@/types';

type TelemetryEvent = 
  | { event: 'service_type_selected'; data: { service_type: ServiceType; context: string } }
  | { event: 'pricing_viewed'; data: { service_type: ServiceType } }
  | { event: 'admin_pricing_updated'; data: { service_type: ServiceType; fields: string[] } };

export const logTelemetry = (event: TelemetryEvent) => {
  // Por ora, apenas console.log (não expor dados sensíveis)
  console.info('[Telemetry]', event.event, event.data);
  
  // Futuro: enviar para analytics provider (ex: Posthog, Mixpanel)
  // analytics.track(event.event, event.data);
};
