import type { ServiceType } from '@/types';

type TelemetryEvent = 
  | { event: 'service_type_selected'; data: { service_type: ServiceType; context: string; available?: boolean } }
  | { event: 'pricing_viewed'; data: { service_type: ServiceType } }
  | { event: 'admin_pricing_updated'; data: { service_type: ServiceType; fields: string[] } }
  | { event: 'availability_blocked'; data: { service_type: ServiceType; region: string; reason: string } }
  | { event: 'offline_mode_used'; data: { page: string } }
  | { event: 'pricing_estimate_shown'; data: { service_type: ServiceType; price_range: string; surge: number } }
  | { event: 'cache_fallback_used'; data: { resource: string } }
  | { event: 'offline_detected'; data: { timestamp: string } }
  | { event: 'quote_offline_fallback'; data: { service_type: ServiceType } };

export const logTelemetry = (event: TelemetryEvent) => {
  // Por ora, apenas console.log (não expor dados sensíveis)
  console.info('[Telemetry]', event.event, event.data);
  
  // Futuro: enviar para analytics provider (ex: Posthog, Mixpanel)
  // analytics.track(event.event, event.data);
};
