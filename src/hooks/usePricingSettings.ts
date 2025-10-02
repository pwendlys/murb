
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceType } from '@/types';

export type ServiceFeeType = 'fixed' | 'percent';

export interface PricingSettings {
  id?: string;
  service_type: ServiceType;
  price_per_km_active: boolean;
  price_per_km: number;
  fixed_price_active: boolean;
  fixed_price: number | null;
  service_fee_type: ServiceFeeType;
  service_fee_value: number;
  updated_by?: string;
}

export const computePriceFromSettings = (settings: PricingSettings, distanceKm: number): number => {
  let base = 0;

  if (settings.fixed_price_active && settings.fixed_price !== null) {
    base = settings.fixed_price;
  } else {
    const perKm = settings.price_per_km_active ? settings.price_per_km : 0;
    base = distanceKm * perKm;
  }

  if (settings.service_fee_type === 'fixed') {
    base += settings.service_fee_value;
  } else {
    base += base * (settings.service_fee_value / 100);
  }

  // Ensure non-negative, rounded to 2 decimals
  return Math.max(0, Math.round(base * 100) / 100);
};

export const usePricingSettings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    // Busca config para moto_taxi por padrão (backward compatibility)
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .eq('service_type', 'moto_taxi')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching pricing settings:', error);
      setSettings(null);
    } else {
      const row = (data && data.length > 0) ? data[0] : null;
      if (row) {
        setSettings({
          id: row.id,
          service_type: row.service_type as ServiceType,
          price_per_km_active: !!row.price_per_km_active,
          price_per_km: Number(row.price_per_km ?? 0),
          fixed_price_active: !!row.fixed_price_active,
          fixed_price: row.fixed_price !== null && row.fixed_price !== undefined ? Number(row.fixed_price) : null,
          service_fee_type: row.service_fee_type as ServiceFeeType,
          service_fee_value: Number(row.service_fee_value ?? 0),
          updated_by: row.updated_by ?? undefined,
        });
      } else {
        setSettings(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();

    const channel = supabase
      .channel('pricing-settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pricing_settings' },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveSettings = async (patch: Partial<PricingSettings>) => {
    if (!user) throw new Error('Not authenticated');
    const serviceType = patch.service_type || settings?.service_type || 'moto_taxi';
    
    // If exists, update; else insert
    if (settings?.id) {
      const { error } = await supabase
        .from('pricing_settings')
        .update({
          ...patch,
          updated_by: user.id,
        })
        .eq('id', settings.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('pricing_settings')
        .insert([{
          service_type: serviceType,
          singleton: false,
          price_per_km_active: patch.price_per_km_active ?? true,
          price_per_km: patch.price_per_km ?? 2.5,
          fixed_price_active: patch.fixed_price_active ?? false,
          fixed_price: patch.fixed_price ?? null,
          service_fee_type: patch.service_fee_type ?? 'fixed',
          service_fee_value: patch.service_fee_value ?? 0,
          updated_by: user.id,
        }]);

      if (error) throw error;
    }

    await fetchSettings();
  };

  const defaultPreview = useMemo<PricingSettings>(() => ({
    service_type: 'moto_taxi',
    price_per_km_active: true,
    price_per_km: 2.5,
    fixed_price_active: false,
    fixed_price: null,
    service_fee_type: 'fixed',
    service_fee_value: 0,
  }), []);

  return {
    settings,
    loading,
    saveSettings,
    compute: (distanceKm: number) => settings ? computePriceFromSettings(settings, distanceKm) : computePriceFromSettings(defaultPreview, distanceKm),
  };
};
