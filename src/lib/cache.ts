import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60s
      gcTime: 5 * 60 * 1000, // 5min (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Cache keys
export const CACHE_KEYS = {
  availability: (region: string) => ['availability', region] as const,
  pricingSettings: (serviceType: string) => ['pricing', serviceType] as const,
  estimatedPrice: (serviceType: string, distance: number) => ['price-estimate', serviceType, distance] as const,
};
