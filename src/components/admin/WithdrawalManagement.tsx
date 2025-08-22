import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { DriverPayoutRequestWithProfile, PayoutStatus } from '@/types';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { DollarSign, Eye, Clock, CheckCircle, XCircle, Calculator } from 'lucide-react';

interface UpdateRequestForm {
  status: PayoutStatus;
  admin_notes: string;
}

const WithdrawalManagement = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<DriverPayoutRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DriverPayoutRequestWithProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<UpdateRequestForm>({
    defaultValues: {
      status: 'pending',
      admin_notes: ''
    }
  });

  useEffect(() => {
    if (user) {
      fetchPayoutRequests();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel('admin-payout-requests')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_payout_requests'
          },
          () => fetchPayoutRequests()
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchPayoutRequests = async () => {
    setLoading(true);
    try {
      // First get all payout requests
      const { data: payoutData, error: payoutError } = await supabase
        .from('driver_payout_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (payoutError) throw payoutError;

      if (!payoutData || payoutData.length === 0) {
        setRequests([]);
        return;
      }

      // Get unique driver IDs
      const driverIds = [...new Set(payoutData.map(req => req.driver_id))];

      // Get driver profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', driverIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const requestsWithProfiles = payoutData.map(request => ({
        ...request,
        profiles: profilesData?.find(profile => profile.id === request.driver_id) || null
      }));

      setRequests(requestsWithProfiles);
    } catch (error: any) {
      console.error('Error fetching payout requests:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  };

  const handleViewRequest = (request: DriverPayoutRequestWithProfile) => {
    setSelectedRequest(request);
    form.reset({
      status: request.status,
      admin_notes: request.admin_notes || ''
    });
    setDialogOpen(true);
  };

  const handleUpdateRequest = async (values: UpdateRequestForm) => {
    if (!selectedRequest || !user) return;

    try {
      const updateData: any = {
        status: values.status,
        admin_notes: values.admin_notes || null,
        processed_by: user.id,
        processed_at: new Date().toISOString()
      };

      const sb = supabase as any;
      const { error } = await sb
        .from('driver_payout_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('Solicitação atualizada com sucesso');
      setDialogOpen(false);
      fetchPayoutRequests();
    } catch (error: any) {
      console.error('Error updating payout request:', error);
      toast.error('Erro ao atualizar solicitação');
    }
  };

  const getStatusColor = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'paid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'paid': return <DollarSign className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovada';
      case 'rejected': return 'Rejeitada';
      case 'paid': return 'Paga';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Carregando solicitações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">Gerenciar Saques</h2>
        <p className="text-muted-foreground">Analise e processe solicitações de saque dos motoristas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Solicitações de Saque
            {requests.length > 0 && (
              <Badge variant="secondary">{requests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma solicitação de saque encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const serviceFee = request.payment_details?.service_fee;
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.profiles?.full_name}</div>
                          {request.profiles?.phone && (
                            <div className="text-sm text-muted-foreground">{request.profiles.phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        <div>
                          <div>R$ {request.amount.toFixed(2)}</div>
                          {serviceFee && (
                            <div className="text-sm text-muted-foreground">
                              Líq.: R$ {serviceFee.net_amount?.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {getStatusLabel(request.status)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>{request.payment_method}</TableCell>
                      <TableCell>
                        {new Date(request.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewRequest(request)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver Detalhes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden pr-1">
                            <DialogHeader>
                              <DialogTitle>Detalhes da Solicitação</DialogTitle>
                              <DialogDescription>
                                Analise e atualize o status da solicitação de saque
                              </DialogDescription>
                            </DialogHeader>

                            {selectedRequest && (
                              <Form {...form}>
                                <form onSubmit={form.handleSubmit(handleUpdateRequest)} className="space-y-4">
                                  <div className="space-y-3">
                                    <div className="text-foreground">
                                      <p className="text-foreground"><strong>Motorista:</strong> {selectedRequest.profiles?.full_name}</p>
                                      <p className="text-foreground"><strong>Método:</strong> {selectedRequest.payment_method}</p>
                                    </div>

                                    {/* Payment Amount Breakdown */}
                                    <div className="p-3 bg-muted/50 rounded-lg space-y-2 border">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Calculator className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium text-sm text-foreground">Detalhes do Pagamento</span>
                                      </div>
                                      
                                      {selectedRequest.payment_details?.service_fee ? (
                                        <>
                                          <div className="flex justify-between text-sm text-foreground">
                                            <span>Valor bruto solicitado:</span>
                                            <span>R$ {selectedRequest.amount.toFixed(2)}</span>
                                          </div>
                                          <div className="flex justify-between text-sm text-destructive">
                                            <span>
                                              Taxa de serviço ({selectedRequest.payment_details.service_fee.type === 'fixed' ? 'fixa' : 'percentual'}):
                                            </span>
                                            <span>- R$ {selectedRequest.payment_details.service_fee.charged_amount?.toFixed(2)}</span>
                                          </div>
                                          <hr className="my-1 border-border" />
                                          <div className="flex justify-between font-medium text-foreground">
                                            <span>Valor líquido a transferir:</span>
                                            <span className="text-green-600">
                                              R$ {selectedRequest.payment_details.service_fee.net_amount?.toFixed(2)}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex justify-between font-medium text-foreground">
                                          <span>Valor a transferir:</span>
                                          <span>R$ {selectedRequest.amount.toFixed(2)}</span>
                                        </div>
                                      )}
                                    </div>

                                    {selectedRequest.notes && (
                                      <div className="text-foreground">
                                        <strong>Observações do motorista:</strong>
                                        <p className="text-sm text-muted-foreground mt-1">{selectedRequest.notes}</p>
                                      </div>
                                    )}
                                    
                                    {selectedRequest.payment_details && (
                                      <div className="text-foreground">
                                        <strong>Detalhes do Pagamento:</strong>
                                        <div className="text-sm bg-muted/50 border p-2 rounded mt-1">
                                          {selectedRequest.payment_details.pix_key && (
                                            <p className="text-foreground"><strong>Chave PIX:</strong> {selectedRequest.payment_details.pix_key}</p>
                                          )}
                                          {Object.keys(selectedRequest.payment_details).filter(key => 
                                            key !== 'service_fee' && key !== 'pix_key'
                                          ).length > 0 && (
                                            <pre className="text-xs mt-2 text-foreground font-mono whitespace-pre-wrap">
                                              {JSON.stringify(
                                                Object.fromEntries(
                                                  Object.entries(selectedRequest.payment_details).filter(([key]) => 
                                                    key !== 'service_fee' && key !== 'pix_key'
                                                  )
                                                ), 
                                                null, 2
                                              )}
                                            </pre>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Selecione o status" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="pending">Pendente</SelectItem>
                                            <SelectItem value="approved">Aprovada</SelectItem>
                                            <SelectItem value="rejected">Rejeitada</SelectItem>
                                            <SelectItem value="paid">Paga</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={form.control}
                                    name="admin_notes"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Observações do Admin</FormLabel>
                                        <FormControl>
                                          <Textarea
                                            placeholder="Adicione observações sobre a solicitação..."
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="flex gap-2 pt-4">
                                    <Button type="submit" className="flex-1">
                                      Atualizar
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
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WithdrawalManagement;
