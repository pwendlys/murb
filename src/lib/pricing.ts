import type { PricingSettings } from '@/hooks/usePricingSettings';

/**
 * Calcula preço com surge multiplier
 */
export const computePriceWithSurge = (
  settings: PricingSettings,
  distanceKm: number,
  surgeMultiplier: number = 1.0
): number => {
  let base = 0;

  if (settings.fixed_price_active && settings.fixed_price !== null) {
    base = settings.fixed_price;
  } else {
    base = distanceKm * (settings.price_per_km_active ? settings.price_per_km : 0);
  }

  if (settings.service_fee_type === 'fixed') {
    base += settings.service_fee_value;
  } else {
    base += base * (settings.service_fee_value / 100);
  }

  base *= surgeMultiplier;

  return Math.max(0, Math.round(base * 100) / 100);
};

/**
 * Formata preço em BRL
 */
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
};

/**
 * Formata tempo estimado
 */
export const formatETA = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
};
