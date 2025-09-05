import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

export const SimpleAdminAuth = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetSecret, setResetSecret] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@ridebuddy.com',
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Senha incorreta. Tente novamente ou redefina a senha.');
        } else {
          throw error;
        }
        return;
      }

      // Verificar se é admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('Erro ao verificar permissões de administrador');
        await supabase.auth.signOut();
        return;
      }

      if (profile.user_type !== 'admin') {
        setError('Acesso negado. Apenas administradores podem acessar.');
        await supabase.auth.signOut();
        return;
      }

      toast.success('Login realizado com sucesso!');
      
      // Redirecionar para o painel admin
      const adminPath = import.meta.env.VITE_ADMIN_SECRET_PATH || '/sistema-interno-2024';
      navigate(`${adminPath}/painel`, { replace: true });

    } catch (error: any) {
      console.error('Error signing in admin:', error);
      setError(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError(null);

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      setResetLoading(false);
      return;
    }

    if (!resetSecret.trim()) {
      setError('O código de segurança é obrigatório');
      setResetLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          newPassword,
          resetSecret: resetSecret.trim()
        }
      });

      if (error) {
        console.error('Reset password error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success('Senha redefinida com sucesso!');
      setShowResetForm(false);
      setNewPassword('');
      setResetSecret('');
      setPassword('');

    } catch (error: any) {
      console.error('Error resetting password:', error);
      if (error.message.includes('Unauthorized')) {
        setError('Código de segurança inválido');
      } else {
        setError(error.message || 'Erro ao redefinir senha');
      }
    } finally {
      setResetLoading(false);
    }
  };

  if (showResetForm) {
    return (
      <Card className="shadow-ride-card border-0">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl">
              <Key className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            Redefinir Senha Admin
          </CardTitle>
          <CardDescription className="text-center">
            Digite uma nova senha e o código de segurança
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                placeholder="Digite a nova senha (mín. 6 caracteres)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resetSecret">Código de Segurança</Label>
              <Input
                id="resetSecret"
                type="password"
                value={resetSecret}
                onChange={(e) => setResetSecret(e.target.value)}
                required
                className="h-11"
                placeholder="Digite o código de segurança"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="flex-1 h-11 bg-ride-gradient hover:opacity-90 transition-opacity" 
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  'Redefinir Senha'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  setShowResetForm(false);
                  setError(null);
                  setNewPassword('');
                  setResetSecret('');
                }}
                disabled={resetLoading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-ride-card border-0">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">
          Admin Login Direto
        </CardTitle>
        <CardDescription className="text-center">
          Sistema de login administrativo simplificado
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Senha Admin</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
              placeholder="Digite sua senha de administrador"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 bg-ride-gradient hover:opacity-90 transition-opacity" 
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Entrar no Painel Admin'
            )}
          </Button>

          <div className="text-center pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowResetForm(true);
                setError(null);
                setPassword('');
              }}
            >
              Esqueci minha senha / Redefinir senha
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Email:</strong> admin@ridebuddy.com<br />
            Para redefinir a senha, você precisará do código de segurança.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};