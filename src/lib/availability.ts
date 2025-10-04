import { supabase } from '@/integrations/supabase/client';
import type { ServiceType } from '@/types';

export interface AvailabilityRule {
  id: string;
  service_type: ServiceType;
  region: string;
  weekday_mask: number[];
  time_start: string;
  time_end: string;
  active: boolean;
  surge_multiplier: number;
  notes?: string;
}

export interface AvailabilityResult {
  available: boolean;
  reason?: 'UNAVAILABLE_REGION' | 'OUT_OF_SCHEDULE' | 'SERVICE_DISABLED';
  surgeMultiplier?: number;
}

/**
 * Checa se um serviço está disponível em uma região/horário
 */
export const canServe = async (params: {
  serviceType: ServiceType;
  region: string;
  datetime?: Date;
}): Promise<AvailabilityResult> => {
  const { serviceType, region, datetime = new Date() } = params;

  const { data: rules, error } = await supabase
    .from('service_availability_rules')
    .select('*')
    .eq('service_type', serviceType)
    .eq('region', region)
    .eq('active', true);

  if (error || !rules || rules.length === 0) {
    return { available: false, reason: 'UNAVAILABLE_REGION' };
  }

  const weekday = datetime.getDay() === 0 ? 7 : datetime.getDay(); // 1=Mon, 7=Sun
  const timeStr = datetime.toTimeString().slice(0, 5); // "HH:MM"

  // Buscar a regra com maior surge_multiplier que se aplica
  let maxSurge = 0;
  let foundMatch = false;

  for (const rule of rules) {
    const inWeekday = rule.weekday_mask.includes(weekday);
    const inTimeRange = timeStr >= rule.time_start && timeStr <= rule.time_end;

    if (inWeekday && inTimeRange) {
      foundMatch = true;
      maxSurge = Math.max(maxSurge, rule.surge_multiplier || 1.0);
    }
  }

  if (!foundMatch) {
    return { available: false, reason: 'OUT_OF_SCHEDULE' };
  }

  return {
    available: true,
    surgeMultiplier: maxSurge,
  };
};

/**
 * Retorna lista de serviços disponíveis em uma região/horário
 */
export const getAvailableServices = async (params: {
  region: string;
  datetime?: Date;
}): Promise<Array<{ serviceType: ServiceType; surgeMultiplier: number }>> => {
  const { region, datetime = new Date() } = params;
  const allTypes: ServiceType[] = ['moto_taxi', 'passenger_car', 'delivery_bike', 'delivery_car'];
  const available = [];

  for (const type of allTypes) {
    const result = await canServe({ serviceType: type, region, datetime });
    if (result.available) {
      available.push({ serviceType: type, surgeMultiplier: result.surgeMultiplier || 1.0 });
    }
  }

  return available;
};
