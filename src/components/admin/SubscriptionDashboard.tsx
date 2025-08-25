import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { 
  listAllSubscriptionsForAdmin,
  listSubscriptionRequestsForAdmin 
} from '@/services/subscriptions';
import { formatBRL } from '@/utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CalendarDays, TrendingUp, Users, DollarSign } from 'lucide-react';

interface SubscriptionStats {
  totalActive: number;
  totalRevenue: number;
  monthlyRevenue: number;
  renewalRequests: number;
  planDistribution: { name: string; value: number; color: string }[];
  monthlyTrend: { month: string; revenue: number; subscriptions: number }[];
}

export const SubscriptionDashboard = () => {
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [subscriptions, requests] = await Promise.all([
        listAllSubscriptionsForAdmin(),
        listSubscriptionRequestsForAdmin()
      ]);

      const now = new Date();
      const activeSubscriptions = subscriptions?.filter(sub => 
        sub.status === 'ativa' && new Date(sub.end_date) > now
      ) || [];

      const totalRevenue = subscriptions?.reduce((sum, sub) => {
        return sum + (sub.subscription_plans?.price_cents || 0);
      }, 0) || 0;

      const monthlyRevenue = activeSubscriptions.reduce((sum, sub) => {
        const priceCents = sub.subscription_plans?.price_cents || 0;
        const durationDays = sub.subscription_plans?.duration_days || 30;
        return sum + (priceCents * 30 / durationDays); // Convert to monthly
      }, 0);

      const pendingRequests = requests?.filter(req => req.status === 'pending')?.length || 0;

      // Plan distribution
      const planCounts: { [key: string]: number } = {};
      activeSubscriptions.forEach(sub => {
        const planName = sub.subscription_plans?.name || 'Desconhecido';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const planDistribution = Object.entries(planCounts).map(([name, value], index) => ({
        name,
        value,
        color: index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--secondary))'
      }));

      // Monthly trend (last 6 months)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthSubs = subscriptions?.filter(sub => {
          const createdAt = new Date(sub.created_at);
          return createdAt >= monthStart && createdAt <= monthEnd;
        }) || [];

        const monthRevenue = monthSubs.reduce((sum, sub) => 
          sum + (sub.subscription_plans?.price_cents || 0), 0
        );

        monthlyTrend.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short' }),
          revenue: monthRevenue / 100, // Convert to reais
          subscriptions: monthSubs.length
        });
      }

      setStats({
        totalActive: activeSubscriptions.length,
        totalRevenue: totalRevenue / 100, // Convert to reais
        monthlyRevenue: monthlyRevenue / 100, // Convert to reais
        renewalRequests: pendingRequests,
        planDistribution,
        monthlyTrend
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">Erro ao carregar dados do dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas Ativas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground">
              Motoristas com assinatura ativa
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(stats.totalRevenue * 100)}</div>
            <p className="text-xs text-muted-foreground">
              Receita total arrecadada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(stats.monthlyRevenue * 100)}</div>
            <p className="text-xs text-muted-foreground">
              Receita recorrente mensal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solicitações Pendentes</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.renewalRequests}</div>
            <p className="text-xs text-muted-foreground">
              Renovações para aprovar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatBRL((value as number) * 100) : value,
                    name === 'revenue' ? 'Receita' : 'Assinaturas'
                  ]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="revenue" />
                <Bar dataKey="subscriptions" fill="hsl(var(--secondary))" name="subscriptions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.planDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Ativas: {stats.totalActive}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Pendentes: {stats.renewalRequests}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Receita Mensal: {formatBRL(stats.monthlyRevenue * 100)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};