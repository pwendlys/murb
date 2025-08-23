import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { 
  listAllFeesForAdmin,
  markFeePaid,
  cancelFee
} from '@/services/fees';
import type { FeePaymentWithProfile } from '@/types/fees';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Bell,
  Calendar,
  DollarSign
} from 'lucide-react';

type FilterType = "ALL" | "D-1" | "D" | "D+" | "PENDING" | "EXPIRED";

export const FeePaymentManagement = () => {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeePaymentWithProfile[]>([]);
  const [filteredFees, setFilteredFees] = useState<FeePaymentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("ALL");
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    fee: FeePaymentWithProfile | null;
    reason: string;
  }>({
    open: false,
    fee: null,
    reason: ''
  });

  useEffect(() => {
    if (user) {
      fetchFees();
    }
  }, [user]);

  useEffect(() => {
    applyFilter();
  }, [fees, activeFilter]);

  const fetchFees = async () => {
    try {
      setLoading(true);
      const data = await listAllFeesForAdmin();
      setFees(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(endOfToday);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    let filtered = [...fees];

    switch (activeFilter) {
      case "PENDING":
        filtered = fees.filter(fee => fee.status === 'pending');
        break;
      case "EXPIRED":
        filtered = fees.filter(fee => fee.status === 'expired');
        break;
      case "D-1":
        // Vence amanhã (payment_due_date ou initial_due_date)
        filtered = fees.filter(fee => {
          if (fee.status !== 'pending') return false;
          const dueDate = fee.payment_due_date ? new Date(fee.payment_due_date) : new Date(fee.initial_due_date);
          return dueDate >= tomorrowStart && dueDate <= tomorrowEnd;
        });
        break;
      case "D":
        // Vence hoje
        filtered = fees.filter(fee => {
          if (fee.status !== 'pending') return false;
          const dueDate = fee.payment_due_date ? new Date(fee.payment_due_date) : new Date(fee.initial_due_date);
          return dueDate >= startOfToday && dueDate <= endOfToday;
        });
        break;
      case "D+":
        // Vencido
        filtered = fees.filter(fee => {
          const dueDate = fee.payment_due_date ? new Date(fee.payment_due_date) : new Date(fee.initial_due_date);
          return dueDate < startOfToday && (fee.status === 'pending' || fee.status === 'expired');
        });
        break;
      default:
        // ALL - mostrar apenas pendentes e expirados
        filtered = fees.filter(fee => fee.status === 'pending' || fee.status === 'expired');
        break;
    }

    setFilteredFees(filtered.sort((a, b) => {
      const dateA = a.payment_due_date ? new Date(a.payment_due_date) : new Date(a.initial_due_date);
      const dateB = b.payment_due_date ? new Date(b.payment_due_date) : new Date(b.initial_due_date);
      return dateA.getTime() - dateB.getTime();
    }));
  };

  const handleMarkAsPaid = async (feeId: string) => {
    try {
      await markFeePaid(feeId);
      toast.success('Pagamento confirmado com sucesso');
      await fetchFees();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCancelFee = async () => {
    if (!cancelDialog.fee || !cancelDialog.reason.trim()) {
      toast.error('Motivo é obrigatório');
      return;
    }

    try {
      await cancelFee(cancelDialog.fee.id, cancelDialog.reason);
      toast.success('Taxa cancelada com sucesso');
      setCancelDialog({ open: false, fee: null, reason: '' });
      await fetchFees();
    } catch (error: any) {
      toast.error(error.message);
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

  const getUrgencyIndicator = (fee: FeePaymentWithProfile) => {
    const now = new Date();
    const dueDate = fee.payment_due_date ? new Date(fee.payment_due_date) : new Date(fee.initial_due_date);
    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) return { color: 'text-red-600', label: 'Vencido', icon: '🚨' };
    if (diffDays === 0) return { color: 'text-orange-600', label: 'Vence hoje', icon: '⚠️' };
    if (diffDays === 1) return { color: 'text-yellow-600', label: 'Vence amanhã', icon: '⏰' };
    return { color: 'text-green-600', label: `${diffDays} dias`, icon: '📅' };
  };

  const getFilterCount = (filterType: FilterType) => {
    if (filterType === "ALL") return fees.filter(f => f.status === 'pending' || f.status === 'expired').length;
    
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(endOfToday);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    switch (filterType) {
      case "PENDING":
        return fees.filter(f => f.status === 'pending').length;
      case "EXPIRED":
        return fees.filter(f => f.status === 'expired').length;
      case "D-1":
        return fees.filter(f => {
          if (f.status !== 'pending') return false;
          const dueDate = f.payment_due_date ? new Date(f.payment_due_date) : new Date(f.initial_due_date);
          return dueDate >= tomorrowStart && dueDate <= tomorrowEnd;
        }).length;
      case "D":
        return fees.filter(f => {
          if (f.status !== 'pending') return false;
          const dueDate = f.payment_due_date ? new Date(f.payment_due_date) : new Date(f.initial_due_date);
          return dueDate >= startOfToday && dueDate <= endOfToday;
        }).length;
      case "D+":
        return fees.filter(f => {
          const dueDate = f.payment_due_date ? new Date(f.payment_due_date) : new Date(f.initial_due_date);
          return dueDate < startOfToday && (f.status === 'pending' || f.status === 'expired');
        }).length;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const filters: { key: FilterType; label: string; icon: any }[] = [
    { key: "ALL", label: "Todas Ativas", icon: Filter },
    { key: "D+", label: "Vencidas", icon: XCircle },
    { key: "D", label: "Vencem Hoje", icon: Calendar },
    { key: "D-1", label: "Vencem Amanhã", icon: Bell },
    { key: "PENDING", label: "Pendentes", icon: CreditCard },
    { key: "EXPIRED", label: "Expiradas", icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Cobrança de Taxas</h2>
          <p className="text-muted-foreground">Gerencie solicitações de pagamento de taxas dos motoristas</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {filters.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={activeFilter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(key)}
                className="flex items-center gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
                <Badge variant="secondary" className="ml-1">
                  {getFilterCount(key)}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de Taxas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Solicitações de Pagamento
            <Badge variant="secondary">{filteredFees.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhuma solicitação encontrada para o filtro selecionado
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFees.map((fee) => {
                const urgency = getUrgencyIndicator(fee);
                const dueDate = fee.payment_due_date ? new Date(fee.payment_due_date) : new Date(fee.initial_due_date);
                const phase = fee.payment_due_date ? 'payment' : 'request';
                
                return (
                  <div key={fee.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <h3 className="font-medium">
                            {fee.profiles?.full_name || 'Motorista'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {fee.profiles?.phone || 'Sem telefone'}
                          </p>
                        </div>
                        <Badge className={getStatusColor(fee.status)}>
                          {getStatusLabel(fee.status)}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">R$ {Number(fee.amount).toFixed(2)}</p>
                        <div className={`text-sm ${urgency.color} flex items-center gap-1`}>
                          <span>{urgency.icon}</span>
                          <span>{urgency.label}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Criado em:</span>
                        <br />
                        {new Date(fee.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div>
                        <span className="font-medium">
                          {phase === 'payment' ? 'Prazo para pagamento:' : 'Prazo para solicitação:'}
                        </span>
                        <br />
                        {dueDate.toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    {fee.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(fee.id)}
                          className="flex items-center gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Marcar como Pago
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setCancelDialog({ open: true, fee, reason: '' })}
                          className="flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancelar
                        </Button>
                      </div>
                    )}

                    {fee.canceled_reason && (
                      <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                        <strong>Motivo do cancelamento:</strong> {fee.canceled_reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Cancelamento */}
      <Dialog open={cancelDialog.open} onOpenChange={(open) => 
        setCancelDialog({ open, fee: null, reason: '' })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Solicitação de Taxa</DialogTitle>
            <DialogDescription>
              Esta ação irá cancelar a solicitação e devolver o valor ao saldo disponível do motorista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Motivo do cancelamento *</Label>
              <Textarea
                id="reason"
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Informe o motivo do cancelamento..."
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setCancelDialog({ open: false, fee: null, reason: '' })}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelFee}
                disabled={!cancelDialog.reason.trim()}
              >
                Confirmar Cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};