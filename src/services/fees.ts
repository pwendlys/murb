import { supabase } from "@/integrations/supabase/client";
import type { FeePayment, DriverBalance, FeePaymentWithProfile } from "@/types/fees";

export async function requestFeePayment(): Promise<FeePayment> {
  const { data, error } = await supabase.rpc("request_fee_payment");
  if (error) {
    if (error.message.includes('not_authenticated')) {
      throw new Error('Usuário não autenticado');
    }
    if (error.message.includes('not_a_driver')) {
      throw new Error('Apenas motoristas podem solicitar pagamento de taxas');
    }
    if (error.message.includes('initial_deadline_expired')) {
      throw new Error('Prazo para solicitar pagamento de taxa expirado (2 dias após cadastro)');
    }
    if (error.message.includes('no_available_funds')) {
      throw new Error('Sem saldo disponível para reservar');
    }
    if (error.message.includes('invalid_fee_amount')) {
      throw new Error('Valor da taxa inválido - verificar configurações do sistema');
    }
    if (error.message.includes('insufficient_funds_for_fee')) {
      throw new Error('Saldo insuficiente para cobrir a taxa de serviço');
    }
    throw new Error(error.message || 'Erro ao solicitar pagamento da taxa');
  }
  return data;
}

export async function markFeePaid(id: string): Promise<FeePayment> {
  const { data, error } = await supabase.rpc("mark_fee_paid", { p_fee_id: id });
  if (error) {
    if (error.message.includes('unauthorized')) {
      throw new Error('Acesso negado');
    }
    if (error.message.includes('fee_not_found')) {
      throw new Error('Solicitação de taxa não encontrada');
    }
    if (error.message.includes('invalid_status')) {
      throw new Error('Status inválido para esta operação');
    }
    throw new Error(error.message || 'Erro ao marcar taxa como paga');
  }
  return data;
}

export async function cancelFee(id: string, reason: string): Promise<FeePayment> {
  const { data, error } = await supabase.rpc("cancel_fee", { p_fee_id: id, p_reason: reason });
  if (error) {
    if (error.message.includes('unauthorized')) {
      throw new Error('Acesso negado');
    }
    if (error.message.includes('fee_not_found')) {
      throw new Error('Solicitação de taxa não encontrada');
    }
    if (error.message.includes('invalid_status')) {
      throw new Error('Status inválido para esta operação');
    }
    throw new Error(error.message || 'Erro ao cancelar taxa');
  }
  return data;
}

export async function listMyFees(): Promise<FeePayment[]> {
  const { data, error } = await supabase
    .from("fee_payments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || 'Erro ao carregar histórico de taxas');
  return data || [];
}

export async function getMyBalances(): Promise<DriverBalance> {
  const { data, error } = await supabase
    .from("driver_balances")
    .select("*")
    .single();
  if (error) {
    // Se não existir, calcular saldos
    if (error.code === 'PGRST116') {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const { data: calculatedBalance, error: calcError } = await supabase
          .rpc("calculate_driver_balance", { p_driver_id: user.user.id });
        if (calcError) throw new Error(calcError.message || 'Erro ao calcular saldos');
        return calculatedBalance;
      }
    }
    throw new Error(error.message || 'Erro ao carregar saldos');
  }
  return data;
}

export async function listAllFeesForAdmin(): Promise<FeePaymentWithProfile[]> {
  const { data: feesData, error } = await supabase
    .from("fee_payments")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) throw new Error(error.message || 'Erro ao carregar solicitações de taxa');
  
  if (!feesData || feesData.length === 0) {
    return [];
  }

  // Get unique driver IDs
  const driverIds = [...new Set(feesData.map(fee => fee.driver_id))];
  
  // Fetch driver profiles
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', driverIds);

  if (profilesError) throw new Error(profilesError.message || 'Erro ao carregar perfis');

  // Create a map of driver profiles
  const profilesMap = new Map();
  profilesData?.forEach(profile => {
    profilesMap.set(profile.id, profile);
  });

  // Combine fees with driver profiles
  const result: FeePaymentWithProfile[] = feesData.map(fee => ({
    ...fee,
    profiles: profilesMap.get(fee.driver_id) || undefined
  }));

  return result;
}

export async function calculateServiceFee(availableBalance: number): Promise<number> {
  try {
    // Buscar configurações de preço
    const { data: settings, error } = await supabase
      .from('pricing_settings')
      .select('service_fee_type, service_fee_value')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !settings || settings.length === 0) {
      return 0;
    }

    const setting = settings[0];
    if (!setting.service_fee_value) return 0;

    if (setting.service_fee_type === 'fixed') {
      return Number(setting.service_fee_value);
    } else if (setting.service_fee_type === 'percent') {
      // Calcular porcentagem sobre o saldo disponível
      return availableBalance * (Number(setting.service_fee_value) / 100);
    }

    return 0;
  } catch (error: any) {
    console.error('Error calculating service fee:', error);
    return 0;
  }
}

export async function getDriverFeeStatus(driverId: string): Promise<{
  daysUntilInitialDeadline: number;
  canRequestFee: boolean;
  hasActiveFee: boolean;
  serviceFeeAmount: number;
  availableBalance: number;
  serviceFeeSettings: { type: string; value: number } | null;
}> {
  try {
    // Buscar data de criação do perfil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", driverId)
      .single();

    if (profileError) throw profileError;

    const createdAt = new Date(profile.created_at);
    const initialDeadline = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 dias
    const now = new Date();
    
    const daysUntilInitialDeadline = Math.ceil((initialDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const canRequestFee = now <= initialDeadline;

    // Verificar se tem taxa ativa
    const { data: activeFee } = await supabase
      .from("fee_payments")
      .select("id")
      .eq("driver_id", driverId)
      .in("status", ["pending", "expired"])
      .limit(1);

    // Buscar saldo disponível e configurações da taxa
    const { data: balance } = await supabase
      .from('driver_balances')
      .select('available')
      .eq('driver_id', driverId)
      .single();

    const { data: settings } = await supabase
      .from('pricing_settings')
      .select('service_fee_type, service_fee_value')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const availableBalance = balance?.available || 0;
    const serviceFeeAmount = await calculateServiceFee(availableBalance);
    const serviceFeeSettings = settings?.[0] ? {
      type: settings[0].service_fee_type,
      value: Number(settings[0].service_fee_value)
    } : null;

    return {
      daysUntilInitialDeadline: Math.max(0, daysUntilInitialDeadline),
      canRequestFee,
      hasActiveFee: (activeFee?.length || 0) > 0,
      serviceFeeAmount,
      availableBalance,
      serviceFeeSettings
    };
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao verificar status da taxa');
  }
}