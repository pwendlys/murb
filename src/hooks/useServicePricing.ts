import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ServiceType } from '@/types';
import type { PricingSettings } from './usePricingSettings';

export const useServicePricing = () => {
  const { user } = useAuth();
  const [allSettings, setAllSettings] = useState<PricingSettings[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllSettings = async () => {
    const { data, error } = await supabase
      .from('pricing_settings')
      .select('*')
      .order('service_type', { ascending: true });

    if (error) {
      console.error('Error fetching all pricing settings:', error);
      setAllSettings([]);
    } else {
      setAllSettings(
        (data || []).map((row) => ({
          id: row.id,
          service_type: row.service_type as ServiceType,
          price_per_km_active: !!row.price_per_km_active,
          price_per_km: Number(row.price_per_km ?? 0),
          fixed_price_active: !!row.fixed_price_active,
          fixed_price: row.fixed_price !== null ? Number(row.fixed_price) : null,
          service_fee_type: row.service_fee_type as 'fixed' | 'percent',
          service_fee_value: Number(row.service_fee_value ?? 0),
          updated_by: row.updated_by ?? undefined,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAllSettings();

    const channel = supabase
      .channel('all-pricing-settings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pricing_settings' },
        () => {
          fetchAllSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = async (serviceType: ServiceType, patch: Partial<PricingSettings>) => {
    if (!user) throw new Error('Not authenticated');

    const existing = allSettings.find((s) => s.service_type === serviceType);
    if (!existing?.id) throw new Error('Settings not found for this service type');

    const { error } = await supabase
      .from('pricing_settings')
      .update({
        ...patch,
        updated_by: user.id,
      })
      .eq('id', existing.id);

    if (error) throw error;
    await fetchAllSettings();
  };

  return {
    allSettings,
    loading,
    updateSettings,
  };
};
