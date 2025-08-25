import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];
type DriverSubscription = Database['public']['Tables']['driver_subscriptions']['Row'];
type SubscriptionRequest = Database['public']['Tables']['subscription_requests']['Row'];

export interface SubscriptionStatus {
  subscription_id: string | null;
  plan_name: string | null;
  duration_days: number | null;
  price_cents: number | null;
  status: 'ativa' | 'vencida' | 'renovacao_solicitada' | 'bloqueada' | null;
  start_date: string | null;
  end_date: string | null;
  days_remaining: number | null;
  has_pending_request: boolean | null;
}

// Buscar planos disponíveis
export const getSubscriptionPlans = async () => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('duration_days', { ascending: true });

  if (error) throw error;
  return data;
};

// Buscar status da assinatura do motorista
export const getDriverSubscriptionStatus = async (driverId: string): Promise<SubscriptionStatus | null> => {
  const { data, error } = await supabase.rpc('get_driver_subscription_status', {
    p_driver_id: driverId
  });

  if (error) throw error;
  return data?.[0] || null;
};

// Solicitar renovação de assinatura
export const requestSubscriptionRenewal = async (planId: string) => {
  const { data, error } = await supabase.rpc('request_subscription_renewal', {
    p_plan_id: planId
  });

  if (error) throw error;
  return data;
};

// Listar todas as assinaturas para admin
export const listAllSubscriptionsForAdmin = async () => {
  const { data, error } = await supabase
    .from('driver_subscriptions')
    .select(`
      id,
      driver_id,
      status,
      start_date,
      end_date,
      created_at,
      updated_at,
      subscription_plans (
        name,
        duration_days,
        price_cents
      ),
      profiles!driver_subscriptions_driver_id_fkey (
        full_name,
        phone
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Listar solicitações de renovação para admin
export const listSubscriptionRequestsForAdmin = async () => {
  const { data, error } = await supabase
    .from('subscription_requests')
    .select(`
      id,
      driver_id,
      status,
      requested_at,
      processed_at,
      processed_by,
      admin_notes,
      subscription_plans (
        name,
        duration_days,
        price_cents
      ),
      profiles!subscription_requests_driver_id_fkey (
        full_name,
        phone
      )
    `)
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return data;
};

// Aprovar pagamento de assinatura (admin)
export const approveSubscriptionPayment = async (requestId: string) => {
  const { data, error } = await supabase.rpc('approve_subscription_payment', {
    p_request_id: requestId
  });

  if (error) throw error;
  return data;
};

// Atualizar preços dos planos (admin)
export const updateSubscriptionPlanPrices = async (planId: string, priceCents: number) => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .update({ price_cents: priceCents })
    .eq('id', planId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

// Cancelar solicitação (admin)
export const rejectSubscriptionRequest = async (requestId: string, reason: string) => {
  const { data, error } = await supabase
    .from('subscription_requests')
    .update({ 
      status: 'rejected',
      admin_notes: reason,
      processed_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data;
};