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
  const { data, error } = await supabase
    .from("fee_payments")
    .select(`
      *,
      profiles (
        id,
        full_name,
        phone
      )
    `)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || 'Erro ao carregar solicitações de taxa');
  return data || [];
}

export async function getDriverFeeStatus(driverId: string): Promise<{
  daysUntilInitialDeadline: number;
  canRequestFee: boolean;
  hasActiveFee: boolean;
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

    return {
      daysUntilInitialDeadline: Math.max(0, daysUntilInitialDeadline),
      canRequestFee,
      hasActiveFee: (activeFee?.length || 0) > 0
    };
  } catch (error: any) {
    throw new Error(error.message || 'Erro ao verificar status da taxa');
  }
}