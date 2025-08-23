import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { listAllFeesForAdmin } from '@/services/fees';
import { FeePaymentWithProfile } from '@/types/fees';
import { 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  Download,
  Calendar
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';

interface DashboardMetrics {
  totalRequests: number;
  pendingRequests: number;
  paidRequests: number;
  expiredRequests: number;
  totalCollected: number;
  totalAmount: number;
  conversionRate: number;
  averageAmount: number;
}

const COLORS = {
  pending: '#f59e0b',
  paid: '#10b981',
  expired: '#ef4444',
  canceled: '#6b7280',
  not_requested: '#a3a3a3'
};

const STATUS_LABELS = {
  not_requested: 'Não Solicitado',
  pending: 'Pendente',
  paid: 'Pago',
  canceled: 'Cancelado',
  expired: 'Vencido'
};

export const TaxDashboard = () => {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeePaymentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('30d');
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRequests: 0,
    pendingRequests: 0,
    paidRequests: 0,
    expiredRequests: 0,
    totalCollected: 0,
    totalAmount: 0,
    conversionRate: 0,
    averageAmount: 0
  });

  useEffect(() => {
    if (user) {
      fetchFees();
    }
  }, [user]);

  useEffect(() => {
    calculateMetrics();
  }, [fees, periodFilter]);

  const fetchFees = async () => {
    try {
      setLoading(true);
      const data = await listAllFeesForAdmin();
      setFees(data);
    } catch (error) {
      console.error('Erro ao carregar taxas:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const now = new Date();
    let filteredFees = fees;

    // Filtro por período
    if (periodFilter !== 'all') {
      const days = parseInt(periodFilter.replace('d', ''));
      const startDate = subDays(now, days);
      filteredFees = fees.filter(fee => 
        new Date(fee.created_at) >= startDate
      );
    }

    const totalRequests = filteredFees.length;
    const pendingRequests = filteredFees.filter(f => f.status === 'pending').length;
    const paidRequests = filteredFees.filter(f => f.status === 'paid').length;
    const expiredRequests = filteredFees.filter(f => f.status === 'expired').length;
    
    const totalCollected = filteredFees
      .filter(f => f.status === 'paid')
      .reduce((sum, f) => sum + (f.actual_fee_amount || 0), 0);
      
    const totalAmount = filteredFees.reduce((sum, f) => sum + f.amount, 0);
    const conversionRate = totalRequests > 0 ? (paidRequests / totalRequests) * 100 : 0;
    const averageAmount = totalRequests > 0 ? totalAmount / totalRequests : 0;

    setMetrics({
      totalRequests,
      pendingRequests,
      paidRequests,
      expiredRequests,
      totalCollected,
      totalAmount,
      conversionRate,
      averageAmount
    });
  };

  const getStatusData = () => {
    const statusCount = fees.reduce((acc, fee) => {
      acc[fee.status] = (acc[fee.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCount).map(([status, count]) => ({
      name: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
      value: count,
      color: COLORS[status as keyof typeof COLORS] || '#gray'
    }));
  };

  const getMonthlyData = () => {
    const monthlyData: Record<string, { collected: number, requested: number }> = {};
    
    fees.forEach(fee => {
      const month = format(new Date(fee.created_at), 'MMM yyyy', { locale: pt });
      if (!monthlyData[month]) {
        monthlyData[month] = { collected: 0, requested: 0 };
      }
      
      monthlyData[month].requested += fee.amount;
      if (fee.status === 'paid') {
        monthlyData[month].collected += fee.actual_fee_amount || 0;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        collected: data.collected,
        requested: data.requested
      }))
      .slice(-6); // Últimos 6 meses
  };

  const filteredFees = fees.filter(fee => {
    const nameMatch = !searchTerm || 
      fee.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || fee.status === statusFilter;
    
    return nameMatch && statusMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/20 text-green-700 dark:text-green-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      case 'expired': return 'bg-red-500/20 text-red-700 dark:text-red-400';
      case 'canceled': return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
      default: return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard de Taxas</h2>
          <p className="text-muted-foreground">Acompanhe as cobranças e arrecadações</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todo período</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Solicitações
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              Média: {formatCurrency(metrics.averageAmount)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.pendingRequests}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.expiredRequests} vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Arrecadado
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.totalCollected)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.paidRequests} pagamentos
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Conversão
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {metrics.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Solicitado → Pago
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getStatusData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Quantidade']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getMonthlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="requested"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.6}
                  name="Solicitado"
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  stackId="2"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.8}
                  name="Arrecadado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Dados */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes das Cobranças</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Pesquisar por nome do motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
                <SelectItem value="canceled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Valor da Taxa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">Nenhuma cobrança encontrada</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFees.slice(0, 10).map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell className="font-medium">
                        {fee.profiles?.full_name || 'Nome não informado'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {formatCurrency(fee.actual_fee_amount || 0)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total: {formatCurrency(fee.amount)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(fee.status)}>
                          {STATUS_LABELS[fee.status] || fee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(fee.created_at), 'dd/MM/yyyy', { locale: pt })}
                      </TableCell>
                      <TableCell>
                        {fee.payment_due_date 
                          ? format(new Date(fee.payment_due_date), 'dd/MM/yyyy', { locale: pt })
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {filteredFees.length > 10 && (
            <div className="flex justify-center mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando 10 de {filteredFees.length} resultados
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};