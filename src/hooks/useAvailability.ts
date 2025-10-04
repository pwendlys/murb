import { useQuery } from '@tanstack/react-query';
import { getAvailableServices } from '@/lib/availability';
import { CACHE_KEYS } from '@/lib/cache';
import type { ServiceType } from '@/types';

export const useAvailability = (region: string, datetime?: Date) => {
  return useQuery({
    queryKey: CACHE_KEYS.availability(region),
    queryFn: () => getAvailableServices({ region, datetime }),
    enabled: !!region,
  });
};

export const useAvailableServiceTypes = (region: string): ServiceType[] => {
  const { data } = useAvailability(region);
  return data?.map((s) => s.serviceType) || ['moto_taxi']; // fallback
};
