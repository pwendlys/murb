import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getDriverSubscriptionStatus, type SubscriptionStatus } from '@/services/subscriptions';
import { supabase } from '@/integrations/supabase/client';

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      const status = await getDriverSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
    } catch (err) {
      console.error('Erro ao buscar status da assinatura:', err);
      setError('Erro ao carregar status da assinatura');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [user?.id]);

  // Configurar real-time para atualizações de assinatura
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_subscriptions',
          filter: `driver_id=eq.${user.id}`
        },
        () => {
          fetchSubscriptionStatus();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscription_requests',
          filter: `driver_id=eq.${user.id}`
        },
        () => {
          fetchSubscriptionStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Verificar se o motorista tem acesso liberado
  const hasActiveAccess = () => {
    if (!subscriptionStatus) return false;
    
    const status = subscriptionStatus.status;
    return status === 'ativa' || status === 'renovacao_solicitada';
  };

  // Verificar se está próximo do vencimento (3 dias ou menos)
  const isNearExpiry = () => {
    if (!subscriptionStatus?.days_remaining) return false;
    return subscriptionStatus.days_remaining <= 3;
  };

  // Verificar se está vencida
  const isExpired = () => {
    return subscriptionStatus?.status === 'vencida';
  };

  // Obter mensagem de status
  const getStatusMessage = () => {
    if (!subscriptionStatus) return 'Sem assinatura ativa';
    
    const { status, days_remaining } = subscriptionStatus;
    
    switch (status) {
      case 'ativa':
        if (days_remaining && days_remaining <= 3) {
          return `Sua assinatura vence em ${days_remaining} dia${days_remaining !== 1 ? 's' : ''}. Você pode renovar agora.`;
        }
        return `Sua assinatura está ativa. Dias restantes: ${days_remaining || 0}.`;
      
      case 'vencida':
        return 'Sua assinatura está vencida. Solicite a renovação pelo app para liberar o acesso.';
      
      case 'renovacao_solicitada':
        return 'Renovação solicitada. Aguardando confirmação do pagamento.';
      
      case 'bloqueada':
        return 'Sua assinatura está bloqueada. Entre em contato com o suporte.';
      
      default:
        return 'Status da assinatura indisponível';
    }
  };

  return {
    subscriptionStatus,
    loading,
    error,
    hasActiveAccess,
    isNearExpiry,
    isExpired,
    getStatusMessage,
    refreshStatus: fetchSubscriptionStatus
  };
};