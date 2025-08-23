import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { DriverPayoutRequest } from '@/types';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { DollarSign, Wallet, TrendingUp, History, Plus, Info } from 'lucide-react';

interface WithdrawalForm {
  amount: number;
  payment_method: string;
  pix_key: string;
  payment_details: any;
  notes: string;
}

export const DriverEarnings = () => {
  const { user } = useAuth();
  const { settings: pricingSettings, loading: pricingLoading } = usePricingSettings();
  const [grossEarnings, setGrossEarnings] = useState(0);
  const [netEarnings, setNetEarnings] = useState(0);
  const [payoutRequests, setPayoutRequests] = useState<DriverPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<WithdrawalForm>({
    defaultValues: {
      amount: 0,
      payment_method: 'pix',
      pix_key: '',
      payment_details: {},
      notes: ''
    }
  });

  const watchAmount = form.watch('amount');
  const watchPaymentMethod = form.watch('payment_method');

  const calculateServiceFee = (amount: number) => {
    if (!pricingSettings || amount <= 0) return 0;
    
    if (pricingSettings.service_fee_type === 'fixed') {
      return pricingSettings.service_fee_value;
    } else {
      return amount * (pricingSettings.service_fee_value / 100);
    }
  };

  const serviceFeeAmount = calculateServiceFee(watchAmount);
  const netWithdrawalAmount = Math.max(0, watchAmount - serviceFeeAmount);

  const availableBalance = Math.max(0, netEarnings - payoutRequests
    .filter(request => request.status === 'pending' || request.status === 'approved')
    .reduce((sum, request) => sum + Number(request.amount), 0));

  const getMaxWithdrawalForMinimumNet = () => {
    if (!pricingSettings) return availableBalance;
    
    const minNet = 10;
    if (pricingSettings.service_fee_type === 'fixed') {
      return Math.min(availableBalance, minNet + pricingSettings.service_fee_value);
    } else {
      const feeRate = pricingSettings.service_fee_value / 100;
      const requiredGross = minNet / (1 - feeRate);
      return Math.min(availableBalance, requiredGross);
    }
  };

  const maxWithdrawalForMinNet = getMaxWithdrawalForMinimumNet();

  useEffect(() => {
    if (user) {
      fetchEarnings();
      fetchPayoutRequests();

      const subscription = supabase
        .channel('driver-payouts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_payout_requests',
            filter: `driver_id=eq.${user.id}`
          },
          () => {
            fetchPayoutRequests();
            fetchEarnings();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchEarnings = async () => {
    if (!user) return;

    try {
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('actual_price, estimated_price')
        .eq('driver_id', user.id)
        .eq('status', 'completed');

      if (ridesError) throw ridesError;

      const gross = rides?.reduce((sum, ride) => {
        const price = ride.actual_price || ride.estimated_price || 0;
        return sum + Number(price);
      }, 0) || 0;

      const { data: paidWithdrawals, error: withdrawalsError } = await supabase
        .from('driver_payout_requests')
        .select('amount')
        .eq('driver_id', user.id)
        .eq('status', 'paid');

      if (withdrawalsError) throw withdrawalsError;

      const totalPaidWithdrawals = paidWithdrawals?.reduce((sum, withdrawal) => {
        return sum + Number(withdrawal.amount);
      }, 0) || 0;

      const net = Math.max(0, gross - totalPaidWithdrawals);

      setGrossEarnings(Number(gross));
      setNetEarnings(Number(net));
    } catch (error: any) {
      console.error('Error fetching earnings:', error);
      toast.error('Erro ao carregar ganhos');
    }
  };

  const fetchPayoutRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('driver_payout_requests')
        .select('*')
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPayoutRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching payout requests:', error);
      toast.error('Erro ao carregar histórico de saques');
    } finally {
      setLoading(false);
    }
  };

  const parseInputValue = (value: string): number => {
    if (!value) return 0;
    const normalizedValue = value.replace(',', '.');
    const parsed = parseFloat(normalizedValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleWithdrawAll = () => {
    form.setValue('amount', availableBalance);
  };

  const handleWithdrawal = async (values: WithdrawalForm) => {
    if (!user || !pricingSettings) return;

    const requestAmount = Number(values.amount);
    const serviceFee = calculateServiceFee(requestAmount);
    const netAmount = requestAmount - serviceFee;

    if (requestAmount > availableBalance) {
      toast.error('Valor solicitado excede o saldo disponível');
      return;
    }

    if (netAmount < 10) {
      toast.error('O valor líquido após descontar a taxa deve ser no mínimo R$ 10,00');
      return;
    }

    if (values.payment_method === 'pix' && !values.pix_key.trim()) {
      toast.error('Chave PIX é obrigatória para pagamentos via PIX');
      return;
    }

    try {
      let paymentDetails = values.payment_details || {};
      if (values.payment_method === 'pix') {
        paymentDetails.pix_key = values.pix_key.trim();
      }

      paymentDetails.service_fee = {
        type: pricingSettings.service_fee_type,
        value: pricingSettings.service_fee_value,
        charged_amount: serviceFee,
        gross_amount: requestAmount,
        net_amount: netAmount
      };

      const { error } = await supabase
        .from('driver_payout_requests')
        .insert({
          driver_id: user.id,
          amount: requestAmount,
          payment_method: values.payment_method,
          payment_details: paymentDetails,
          notes: values.notes || null
        });

      if (error) throw error;

      toast.success('Solicitação de saque enviada com sucesso');
      setDialogOpen(false);
      form.reset({
        amount: 0,
        payment_method: 'pix',
        pix_key: '',
        payment_details: {},
        notes: ''
      });
      
      fetchPayoutRequests();
    } catch (error: any) {
      console.error('Error creating payout request:', error);
      toast.error('Erro ao solicitar saque');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovada';
      case 'rejected': return 'Rejeitada';
      case 'paid': return 'Paga';
      default: return status;
    }
  };

  if (loading || pricingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">Meus Ganhos</h2>
        <p className="text-muted-foreground">Acompanhe seus ganhos e solicite saques</p>
      </div>

      {pricingSettings && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Taxa de Serviço Configurada
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Para saques:</strong> {pricingSettings.service_fee_type === 'fixed' 
                  ? `Taxa fixa de R$ ${pricingSettings.service_fee_value.toFixed(2)} será descontada no processamento do pagamento.`
                  : `Taxa de ${pricingSettings.service_fee_value}% será descontada no processamento do pagamento.`
                }
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Para cobrança de taxas obrigatórias:</strong> {pricingSettings.service_fee_type === 'fixed' 
                  ? `Valor fixo de R$ ${pricingSettings.service_fee_value.toFixed(2)} deve ser pago pelos motoristas.`
                  : `${pricingSettings.service_fee_value}% dos ganhos totais deve ser pago pelos motoristas.`
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ganhos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              R$ {netEarnings.toFixed(2)}
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
              R$ {availableBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitações</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payoutRequests.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Solicitar Saque
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={availableBalance < maxWithdrawalForMinNet}>
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Saque
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden">
                <DialogHeader>
                  <DialogTitle>Solicitar Saque</DialogTitle>
                  <DialogDescription>
                    Saldo disponível: R$ {availableBalance.toFixed(2)}
                    <br />
                    Valor mínimo líquido após taxa: R$ 10,00
                    <br />
                    <span className="text-xs text-muted-foreground">
                      * A taxa de serviço será descontada pelo administrador no processamento
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleWithdrawal)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      rules={{
                        required: 'Valor é obrigatório',
                        min: { value: 1, message: 'Valor deve ser maior que R$ 1,00' },
                        max: { value: availableBalance, message: 'Valor excede o saldo disponível' }
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor do Saque</FormLabel>
                          <div className="flex gap-2">
                            <FormControl className="flex-1">
                              <Input
                                type="text"
                                placeholder="0,00"
                                {...field}
                                onChange={(e) => {
                                  const parsedValue = parseInputValue(e.target.value);
                                  field.onChange(parsedValue);
                                }}
                                value={field.value > 0 ? field.value.toString().replace('.', ',') : ''}
                              />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm"
                              onClick={handleWithdrawAll}
                              disabled={availableBalance <= 0}
                            >
                              Sacar tudo
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchAmount > 0 && pricingSettings && (
                      <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Valor solicitado:</span>
                          <span>R$ {watchAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Taxa de serviço ({pricingSettings.service_fee_type === 'fixed' ? 'fixa' : `${pricingSettings.service_fee_value}%`}):</span>
                          <span>- R$ {serviceFeeAmount.toFixed(2)}</span>
                        </div>
                        <hr />
                        <div className="flex justify-between font-medium">
                          <span>Valor líquido que você receberá:</span>
                          <span className="text-green-600">R$ {netWithdrawalAmount.toFixed(2)}</span>
                        </div>
                        {netWithdrawalAmount < 10 && watchAmount > 0 && (
                          <p className="text-sm text-red-600">
                            ⚠️ O valor líquido deve ser no mínimo R$ 10,00
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          * A taxa será descontada pelo administrador no processamento do pagamento
                        </p>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="payment_method"
                      rules={{ required: 'Método de pagamento é obrigatório' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Método de Pagamento</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o método" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pix">PIX</SelectItem>
                              <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                              <SelectItem value="ted">TED</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchPaymentMethod === 'pix' && (
                      <FormField
                        control={form.control}
                        name="pix_key"
                        rules={{ required: 'Chave PIX é obrigatória' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave PIX *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Digite sua chave PIX (CPF, e-mail, telefone ou chave aleatória)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Informações adicionais sobre o pagamento (dados bancários, etc.)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={netWithdrawalAmount < 10 || watchAmount > availableBalance}
                      >
                        Solicitar Saque
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availableBalance < maxWithdrawalForMinNet ? (
            <p className="text-muted-foreground">
              Saldo insuficiente para saque. Valor mínimo líquido: R$ 10,00
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Você pode sacar até R$ {availableBalance.toFixed(2)}
              </p>
              {pricingSettings && (
                <p className="text-sm text-muted-foreground">
                  * Taxa de serviço será descontada pelo administrador no processamento
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Saques
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma solicitação de saque encontrada</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payoutRequests.map((request) => {
                const serviceFee = request.payment_details?.service_fee;
                return (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">R$ {Number(request.amount).toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        {request.payment_method} • {new Date(request.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      {request.payment_method === 'pix' && request.payment_details?.pix_key && (
                        <div className="text-sm text-muted-foreground">
                          PIX: {request.payment_details.pix_key}
                        </div>
                      )}
                      {serviceFee && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Taxa: R$ {serviceFee.charged_amount?.toFixed(2)} • 
                          Líquido: R$ {serviceFee.net_amount?.toFixed(2)}
                        </div>
                      )}
                      {request.admin_notes && (
                        <div className="text-sm text-muted-foreground mt-1">
                          <strong>Admin:</strong> {request.admin_notes}
                        </div>
                      )}
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      {getStatusLabel(request.status)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
