import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listAllFeesForAdmin } from '@/services/fees';
import { supabase } from '@/integrations/supabase/client';
import type { FeePaymentWithProfile } from '@/types/fees';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Clock, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  CreditCard,
  Eye
} from 'lucide-react';

export const FeePaymentManagement = () => {
  const [fees, setFees] = useState<FeePaymentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'canceled' | 'expired'>('all');
  const [selectedFee, setSelectedFee] = useState<FeePaymentWithProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchFees();
  }, []);

  const fetchFees = async () => {
    try {
      setLoading(true);
      const data = await listAllFeesForAdmin();
      setFees(data);
    } catch (error: any) {
      console.error('Error fetching fees:', error);
      toast.error('Erro ao carregar pagamentos de taxa');
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (feeId: string) => {
    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('mark_fee_paid', {
        p_fee_id: feeId
      });

      if (error) throw error;

      toast.success('Pagamento marcado como pago!');
      await fetchFees();
      setDialogOpen(false);
      setSelectedFee(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao marcar como pago');
    } finally {
      setProcessing(false);
    }
  };

  const cancelFee = async (feeId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Por favor, informe o motivo do cancelamento');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('cancel_fee', {
        p_fee_id: feeId,
        p_reason: reason
      });

      if (error) throw error;

      toast.success('Pagamento cancelado!');
      await fetchFees();
      setDialogOpen(false);
      setSelectedFee(null);
      setCancelReason('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar pagamento');
    } finally {
      setProcessing(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'canceled': return <XCircle className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredFees = fees.filter(fee => {
    if (statusFilter === 'all') return true;
    return fee.status === statusFilter;
  });

  const stats = {
    total: fees.length,
    pending: fees.filter(f => f.status === 'pending').length,
    paid: fees.filter(f => f.status === 'paid').length,
    expired: fees.filter(f => f.status === 'expired').length,
    totalAmount: fees.filter(f => f.status === 'paid').reduce((sum, f) => sum + Number(f.actual_fee_amount || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando pagamentos de taxa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">Gerenciamento de Pagamentos de Taxa</h2>
        <p className="text-muted-foreground">Gerencie solicitações de pagamento de taxa dos motoristas</p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Arrecadado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {stats.totalAmount.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Solicitações de Pagamento ({filteredFees.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma solicitação encontrada
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {filteredFees.map((fee) => (
                <div 
                  key={fee.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(fee.status)}
                      <Badge className={getStatusColor(fee.status)}>
                        {getStatusLabel(fee.status)}
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {fee.profiles?.full_name || 'Nome não disponível'}
                        </span>
                        {fee.profiles?.phone && (
                          <span className="text-sm text-muted-foreground">
                            • {fee.profiles.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          R$ {Number(fee.actual_fee_amount || 0).toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(fee.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        {fee.payment_due_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Vence: {new Date(fee.payment_due_date).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedFee(fee);
                        setDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          
          {selectedFee && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Motorista:</span>
                  <span className="font-medium">{selectedFee.profiles?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Telefone:</span>
                  <span>{selectedFee.profiles?.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Taxa a Receber:</span>
                  <span className="font-bold text-lg text-green-600">R$ {Number(selectedFee.actual_fee_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Saldo Reservado:</span>
                  <span className="text-muted-foreground">R$ {Number(selectedFee.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Saldo Anterior:</span>
                  <span className="text-muted-foreground">R$ {Number(selectedFee.available_balance_before || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge className={getStatusColor(selectedFee.status)}>
                    {getStatusLabel(selectedFee.status)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Solicitado em:</span>
                  <span>{new Date(selectedFee.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {selectedFee.payment_due_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Vencimento:</span>
                    <span>{new Date(selectedFee.payment_due_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
                {selectedFee.canceled_reason && (
                  <div>
                    <span className="text-sm text-muted-foreground">Motivo cancelamento:</span>
                    <p className="text-sm mt-1 p-2 bg-red-50 rounded">{selectedFee.canceled_reason}</p>
                  </div>
                )}
              </div>

              {selectedFee.status === 'pending' && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="grid gap-2">
                    <Button
                      onClick={() => markAsPaid(selectedFee.id)}
                      disabled={processing}
                      className="w-full"
                    >
                      {processing ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Marcar como Pago
                        </>
                      )}
                    </Button>
                    
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Motivo do cancelamento"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={3}
                      />
                      <Button
                        variant="destructive"
                        onClick={() => cancelFee(selectedFee.id, cancelReason)}
                        disabled={processing || !cancelReason.trim()}
                        className="w-full"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancelar Pagamento
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};