import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search, Settings, Check, X, Clock, AlertTriangle, Users } from 'lucide-react';
import { 
  listAllSubscriptionsForAdmin, 
  listSubscriptionRequestsForAdmin,
  approveSubscriptionPayment,
  rejectSubscriptionRequest,
  getSubscriptionPlans,
  updateSubscriptionPlanPrices
} from '@/services/subscriptions';
import { formatBRL } from '@/utils/currency';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionWithProfile {
  id: string;
  driver_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  subscription_plans: {
    name: string;
    duration_days: number;
    price_cents: number;
  };
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface RequestWithProfile {
  id: string;
  driver_id: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  subscription_plans: {
    name: string;
    duration_days: number;
    price_cents: number;
  };
  profiles: {
    full_name: string;
    phone: string;
  };
}

export const SubscriptionManagement = () => {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithProfile[]>([]);
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subscriptionsData, requestsData, plansData] = await Promise.all([
        listAllSubscriptionsForAdmin(),
        listSubscriptionRequestsForAdmin(),
        getSubscriptionPlans()
      ]);
      
      setSubscriptions(subscriptionsData as any);
      setRequests(requestsData as any);
      setPlans(plansData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados das assinaturas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      setProcessingRequest(requestId);
      await approveSubscriptionPayment(requestId);
      
      toast({
        title: "Sucesso",
        description: "Pagamento aprovado e acesso liberado!",
      });
      
      fetchData();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast({
        title: "Erro",
        description: "Erro ao aprovar pagamento",
        variant: "destructive"
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (requestId: string, reason: string) => {
    try {
      setProcessingRequest(requestId);
      await rejectSubscriptionRequest(requestId, reason);
      
      toast({
        title: "Sucesso",
        description: "Solicitação rejeitada",
      });
      
      fetchData();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast({
        title: "Erro",
        description: "Erro ao rejeitar solicitação",
        variant: "destructive"
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleUpdatePlanPrice = async (planId: string, newPrice: number) => {
    try {
      await updateSubscriptionPlanPrices(planId, newPrice * 100); // converter para centavos
      toast({
        title: "Sucesso",
        description: "Preço atualizado com sucesso!",
      });
      fetchData();
      setSettingsOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar preço:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar preço",
        variant: "destructive"
      });
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sub.profiles.phone?.includes(searchTerm);
    
    if (statusFilter === 'all') return matchesSearch;
    
    // Calcular status dinâmico
    const now = new Date();
    const endDate = new Date(sub.end_date);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (statusFilter) {
      case 'active':
        return matchesSearch && sub.status === 'ativa' && daysRemaining > 3;
      case 'expiring':
        return matchesSearch && sub.status === 'ativa' && daysRemaining <= 3 && daysRemaining >= 0;
      case 'expired':
        return matchesSearch && (sub.status === 'vencida' || daysRemaining < 0);
      case 'blocked':
        return matchesSearch && sub.status === 'bloqueada';
      default:
        return matchesSearch;
    }
  });

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         req.profiles.phone?.includes(searchTerm);
    return matchesSearch && req.status === 'pending';
  });

  const getStatusBadge = (subscription: SubscriptionWithProfile) => {
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (subscription.status === 'bloqueada') {
      return <Badge variant="destructive">Bloqueada</Badge>;
    }
    
    if (subscription.status === 'vencida' || daysRemaining < 0) {
      return <Badge variant="destructive">Vencida</Badge>;
    }
    
    if (daysRemaining <= 3) {
      return <Badge variant="secondary">Vence em {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''}</Badge>;
    }
    
    return <Badge variant="default">Ativa</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStats = () => {
    const now = new Date();
    const active = subscriptions.filter(sub => {
      const endDate = new Date(sub.end_date);
      return sub.status === 'ativa' && endDate > now;
    }).length;
    
    const expired = subscriptions.filter(sub => {
      const endDate = new Date(sub.end_date);
      return sub.status === 'vencida' || endDate < now;
    }).length;
    
    const pending = requests.filter(req => req.status === 'pending').length;
    
    return { total: subscriptions.length, active, expired, pending };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Solicitações</p>
                <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gerenciar Assinaturas</CardTitle>
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Configurar Preços
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configurar Preços dos Planos</DialogTitle>
                  <DialogDescription>
                    Defina os valores dos planos de assinatura
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">
                          {plan.name === 'meia' ? 'Meia Assinatura' : 'Assinatura Completa'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {plan.duration_days} dias
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={(plan.price_cents / 100).toFixed(2)}
                          className="w-24"
                          onBlur={(e) => {
                            const newPrice = parseFloat(e.target.value);
                            if (newPrice !== plan.price_cents / 100) {
                              handleUpdatePlanPrice(plan.id, newPrice);
                            }
                          }}
                        />
                        <span className="text-sm text-muted-foreground">R$</span>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="expiring">Vencendo em breve</SelectItem>
                <SelectItem value="expired">Vencidas</SelectItem>
                <SelectItem value="blocked">Bloqueadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="subscriptions" className="w-full">
            <TabsList>
              <TabsTrigger value="subscriptions">Assinaturas ({filteredSubscriptions.length})</TabsTrigger>
              <TabsTrigger value="requests">Solicitações ({filteredRequests.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="subscriptions" className="space-y-4">
              {filteredSubscriptions.map((subscription) => (
                <Card key={subscription.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{subscription.profiles.full_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {subscription.profiles.phone}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span>
                            {subscription.subscription_plans.name === 'meia' ? 'Meia' : 'Completa'} • 
                            {subscription.subscription_plans.duration_days} dias • 
                            {formatBRL(subscription.subscription_plans.price_cents)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(subscription.start_date)} - {formatDate(subscription.end_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(subscription)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredSubscriptions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma assinatura encontrada
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="requests" className="space-y-4">
              {filteredRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{request.profiles.full_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {request.profiles.phone}
                        </p>
                        <div className="flex items-center gap-2 text-sm">
                          <span>
                            {request.subscription_plans.name === 'meia' ? 'Meia' : 'Completa'} • 
                            {request.subscription_plans.duration_days} dias • 
                            {formatBRL(request.subscription_plans.price_cents)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Solicitado em {formatDate(request.requested_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id, 'Pagamento não confirmado')}
                          disabled={processingRequest === request.id}
                        >
                          {processingRequest === request.id ? (
                            <LoadingSpinner className="w-4 h-4" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(request.id)}
                          disabled={processingRequest === request.id}
                        >
                          {processingRequest === request.id ? (
                            <LoadingSpinner className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Marcar como Pago
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredRequests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação pendente
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};