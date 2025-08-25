import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CalendarDays, Clock, CreditCard, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { getSubscriptionPlans, requestSubscriptionRenewal } from '@/services/subscriptions';
import { formatBRL } from '@/utils/currency';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  duration_days: number;
  price_cents: number;
}

export const DriverSubscriptions = () => {
  const { user } = useAuth();
  const { 
    subscriptionStatus, 
    loading: subscriptionLoading, 
    hasActiveAccess, 
    isNearExpiry, 
    isExpired,
    getStatusMessage,
    refreshStatus 
  } = useSubscription();
  const { toast } = useToast();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [requestingRenewal, setRequestingRenewal] = useState<string | null>(null);

  // Buscar planos disponíveis
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await getSubscriptionPlans();
        setPlans(data);
      } catch (error) {
        console.error('Erro ao buscar planos:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar planos de assinatura",
          variant: "destructive"
        });
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, [toast]);

  const handleRequestRenewal = async (planId: string) => {
    if (!user?.id) return;

    try {
      setRequestingRenewal(planId);
      await requestSubscriptionRenewal(planId);
      
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de renovação foi enviada com sucesso!",
      });

      // Atualizar status
      refreshStatus();
    } catch (error: any) {
      console.error('Erro ao solicitar renovação:', error);
      
      let message = "Erro ao solicitar renovação";
      if (error.message?.includes('pending_request_exists')) {
        message = "Você já tem uma solicitação pendente. Aguarde o processamento.";
      } else if (error.message?.includes('not_a_driver')) {
        message = "Apenas motoristas podem solicitar assinaturas.";
      }
      
      toast({
        title: "Erro",
        description: message,
        variant: "destructive"
      });
    } finally {
      setRequestingRenewal(null);
    }
  };

  const getStatusColor = () => {
    if (!subscriptionStatus) return 'secondary';
    
    switch (subscriptionStatus.status) {
      case 'ativa':
        return isNearExpiry() ? 'warning' : 'success';
      case 'vencida':
        return 'destructive';
      case 'renovacao_solicitada':
        return 'secondary';
      case 'bloqueada':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getProgressValue = () => {
    if (!subscriptionStatus?.days_remaining || !subscriptionStatus?.duration_days) return 0;
    
    const daysUsed = subscriptionStatus.duration_days - subscriptionStatus.days_remaining;
    return Math.max(0, Math.min(100, (daysUsed / subscriptionStatus.duration_days) * 100));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (subscriptionLoading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status da Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Status da Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status Atual:</span>
            <Badge variant={getStatusColor() as any}>
              {subscriptionStatus?.status === 'ativa' ? 'Ativa' :
               subscriptionStatus?.status === 'vencida' ? 'Vencida' :
               subscriptionStatus?.status === 'renovacao_solicitada' ? 'Renovação Solicitada' :
               subscriptionStatus?.status === 'bloqueada' ? 'Bloqueada' :
               'Sem Assinatura'}
            </Badge>
          </div>

          {subscriptionStatus && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progresso do período:</span>
                  <span>{subscriptionStatus.days_remaining || 0} dias restantes</span>
                </div>
                <Progress value={getProgressValue()} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Início</p>
                    <p className="text-muted-foreground">{formatDate(subscriptionStatus.start_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Vencimento</p>
                    <p className="text-muted-foreground">{formatDate(subscriptionStatus.end_date)}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Mensagem de status */}
          <div className={`p-3 rounded-lg ${
            isExpired() ? 'bg-destructive/10 text-destructive' :
            isNearExpiry() ? 'bg-warning/10 text-warning' :
            'bg-muted'
          }`}>
            <div className="flex items-start gap-2">
              {(isExpired() || isNearExpiry()) && (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <p className="text-sm">{getStatusMessage()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Planos Disponíveis */}
      <Card>
        <CardHeader>
          <CardTitle>Planos de Assinatura</CardTitle>
          <p className="text-sm text-muted-foreground">
            Escolha o plano que melhor atende suas necessidades
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="text-center">
                      <h3 className="text-lg font-semibold capitalize">
                        {plan.name === 'meia' ? 'Meia Assinatura' : 'Assinatura Completa'}
                      </h3>
                      <p className="text-2xl font-bold text-primary">
                        {formatBRL(plan.price_cents)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {plan.duration_days} dias
                      </p>
                    </div>

                    <Button
                      onClick={() => handleRequestRenewal(plan.id)}
                      disabled={
                        requestingRenewal === plan.id ||
                        (subscriptionStatus?.has_pending_request && !isExpired())
                      }
                      className="w-full"
                      variant={plan.name === 'completa' ? 'default' : 'outline'}
                    >
                      {requestingRenewal === plan.id ? (
                        <LoadingSpinner className="w-4 h-4" />
                      ) : subscriptionStatus?.status === 'ativa' ? (
                        `Renovar ${plan.duration_days} dias`
                      ) : (
                        `Assinar ${plan.duration_days} dias`
                      )}
                    </Button>

                    {subscriptionStatus?.has_pending_request && !isExpired() && (
                      <p className="text-xs text-center text-muted-foreground">
                        Você já tem uma solicitação pendente
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {plans.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum plano disponível no momento
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};