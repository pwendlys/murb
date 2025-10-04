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
  | { event: 'quote_offline_fallback'; data: { service_type: ServiceType } }
  | { event: 'service_filtered_count'; data: { filtered_count: number; available_count: number; region: string } }
  | { event: 'service_unavailable_click'; data: { service_type: ServiceType; reason: string } }
  | { event: 'admin_tab_opened'; data: { tab: string } }
  | { event: 'admin_access_blocked'; data: { attempted_path: string } }
  | { event: 'admin_pricing_saved'; data: { service_type: ServiceType } }
  | { event: 'admin_availability_saved'; data: { rule_id: string; service_type: ServiceType } }
  | { event: 'sw_installed'; data: { timestamp: string } }
  | { event: 'sw_activated'; data: { timestamp: string } }
  | { event: 'response_cache_hit'; data: { url: string } }
  | { event: 'query_cache_hit'; data: { queryKey: string } }
  | { event: 'query_cache_miss'; data: { queryKey: string } };

export const logTelemetry = (event: TelemetryEvent) => {
  // Por ora, apenas console.log (não expor dados sensíveis)
  console.info('[Telemetry]', event.event, event.data);
  
  // Futuro: enviar para analytics provider (ex: Posthog, Mixpanel)
  // analytics.track(event.event, event.data);
};
