import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  requestFeePayment, 
  getMyBalances, 
  getDriverFeeStatus,
  listMyFees,
  calculateServiceFeePreview
} from '@/services/fees';
import type { DriverBalance, FeePayment } from '@/types/fees';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Wallet, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  CreditCard
} from 'lucide-react';

export const DriverFeePayments = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<DriverBalance | null>(null);
  const [fees, setFees] = useState<FeePayment[]>([]);
  const [feeStatus, setFeeStatus] = useState<{
    daysUntilInitialDeadline: number;
    canRequestFee: boolean;
    hasActiveFee: boolean;
  } | null>(null);
  const [feeAmount, setFeeAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (user) {
      refreshData();
      
      // Subscribe to driver_balances changes for real-time updates
      const subscription = supabase
        .channel('driver_balance_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_balances',
            filter: `driver_id=eq.${user.id}`
          },
          () => {
            // Refresh data when balance changes
            refreshData();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const refreshData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [balanceData, feesData, statusData] = await Promise.all([
        getMyBalances(),
        listMyFees(),
        getDriverFeeStatus(user.id)
      ]);
      
      setBalance(balanceData);
      setFees(feesData);
      setFeeStatus(statusData);
      
      // Calcular valor da taxa baseado nas configurações
      try {
        const feePreview = await calculateServiceFeePreview();
        setFeeAmount(feePreview);
      } catch (error) {
        console.error('Error calculating fee preview:', error);
        setFeeAmount(0);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(error.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayment = async () => {
    try {
      setRequesting(true);
      await requestFeePayment();
      toast.success('Solicitação de pagamento de taxa enviada com sucesso!');
      await refreshData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRequesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'paid': return 'Pago';
      case 'canceled': return 'Cancelado';
      case 'expired': return 'Vencido';
      default: return status;
    }
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 0) return 'text-red-600';
    if (days === 1) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressValue = (days: number) => {
    const maxDays = 2;
    return Math.max(0, (days / maxDays) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const available = balance?.available || 0;
  const reserved = balance?.reserved || 0;
  const total = balance?.total_earnings || 0;
  const canRequest = feeStatus?.canRequestFee && !feeStatus?.hasActiveFee && available >= feeAmount && feeAmount > 0;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">Pagamento de Taxas</h2>
        <p className="text-muted-foreground">Gerencie suas obrigações de pagamento de taxa</p>
      </div>

      {/* Status do Prazo */}
      {feeStatus && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Status do Prazo para Solicitação
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {feeStatus.canRequestFee ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${getUrgencyColor(feeStatus.daysUntilInitialDeadline)}`}>
                    {feeStatus.daysUntilInitialDeadline > 0 
                      ? `${feeStatus.daysUntilInitialDeadline} dia(s) restante(s)`
                      : 'Último dia!'
                    }
                  </span>
                </div>
                <Progress 
                  value={getProgressValue(feeStatus.daysUntilInitialDeadline)} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Você tem 2 dias após seu cadastro para solicitar o pagamento da taxa
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Prazo para solicitação expirado</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saldos */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ganhos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {total.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {available.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reservado p/ Taxas</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {reserved.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solicitar Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Solicitar Pagamento de Taxa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feeAmount > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor da Taxa de Serviço:</span>
                <span className="text-lg font-bold text-primary">R$ {feeAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground">
            Ao solicitar, o valor da taxa será reservado do seu saldo disponível.
            Você terá 2 dias para efetuar o pagamento após a solicitação.
          </p>
          
          {available < feeAmount && feeAmount > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Saldo insuficiente. Necessário: R$ {feeAmount.toFixed(2)}, Disponível: R$ {available.toFixed(2)}
                </span>
              </div>
            </div>
          )}
          
          <Button 
            onClick={handleRequestPayment}
            disabled={!canRequest || requesting}
            className="w-full"
          >
            {requesting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Processando...
              </>
            ) : canRequest ? (
              `Solicitar Pagamento (R$ ${feeAmount.toFixed(2)})`
            ) : feeStatus?.hasActiveFee ? (
              'Você já possui uma solicitação ativa'
            ) : !feeStatus?.canRequestFee ? (
              'Prazo para solicitação expirou'
            ) : (
              'Sem saldo disponível'
            )}
          </Button>

          {canRequest && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Lembre-se:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• O valor será reservado imediatamente</li>
                    <li>• Você terá 2 dias para efetuar o pagamento</li>
                    <li>• Após o vencimento, entre em contato com o administrador</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Solicitações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Histórico de Solicitações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma solicitação de pagamento de taxa encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {fees.map((fee) => (
                <div 
                  key={fee.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(fee.status)}>
                        {getStatusLabel(fee.status)}
                      </Badge>
                      <span className="font-medium">R$ {Number(fee.amount).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Solicitado em: {new Date(fee.created_at).toLocaleDateString('pt-BR')}
                      {fee.payment_due_date && (
                        <span className="ml-2">
                          • Vence em: {new Date(fee.payment_due_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    {fee.canceled_reason && (
                      <div className="text-sm text-red-600">
                        Motivo do cancelamento: {fee.canceled_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};