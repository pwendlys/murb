
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const AdminAuth = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    checkAdminSetup();
  }, []);

  const checkAdminSetup = async () => {
    try {
      console.log('Checking admin setup status...');
      
      // Primeira tentativa: verificar se existe admin configurado
      const { data: adminSetups, error: setupError } = await supabase
        .from('admin_setup')
        .select('password_set, admin_user_id, updated_at')
        .order('updated_at', { ascending: false });

      console.log('Admin setup query result:', { adminSetups, setupError });

      if (setupError) {
        console.error('Error querying admin_setup:', setupError);
        // Em caso de erro, verificar se existe perfil admin como fallback
        const { data: adminProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, user_type')
          .eq('user_type', 'admin')
          .limit(1)
          .maybeSingle();

        console.log('Admin profile fallback:', { adminProfile, profileError });
        
        if (adminProfile) {
          console.log('Found admin profile, assuming configured - showing login mode');
          setIsSetupMode(false);
        } else {
          console.log('No admin profile found, showing setup mode');
          setIsSetupMode(true);
        }
        return;
      }

      // Se encontrou registros de admin_setup
      if (adminSetups && adminSetups.length > 0) {
        const configuredAdmin = adminSetups.find(admin => admin.password_set === true);
        
        if (configuredAdmin) {
          console.log('Admin is configured, showing login mode');
          setIsSetupMode(false);
        } else {
          console.log('Admin exists but not configured, showing setup mode');
          setIsSetupMode(true);
        }
      } else {
        console.log('No admin setup records found, showing setup mode');
        setIsSetupMode(true);
      }
    } catch (error) {
      console.error('Error checking admin setup:', error);
      // Em caso de erro, assumir que precisa configurar
      setIsSetupMode(true);
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleFirstSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    try {
      console.log('Calling setup-admin edge function...');
      
      const { data, error } = await supabase.functions.invoke('setup-admin', {
        body: { password }
      });

      console.log('Setup-admin response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Setup error from function:', data.error);
        throw new Error(data.error);
      }

      console.log('Admin setup successful, attempting sign in...');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: 'admin@ridebuddy.com',
        password,
      });

      if (signInError) {
        console.error('Sign in error:', signInError);
        throw signInError;
      }

      console.log('Admin signed in successfully');
      
    } catch (error: any) {
      console.error('Error setting up admin:', error);
      setError(error.message || 'Erro ao configurar senha do administrador');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'admin@ridebuddy.com',
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Senha incorreta. Tente novamente.');
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error signing in admin:', error);
      setError(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <Card className="shadow-ride-card border-0">
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">
            {isSetupMode ? 'Configurar Administrador' : 'Login Admin'}
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCheckingSetup(true);
              setError(null);
              checkAdminSetup();
            }}
            className="flex items-center gap-2"
            disabled={checkingSetup}
          >
            <RefreshCw className={`h-4 w-4 ${checkingSetup ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>
        <CardDescription className="text-center">
          {isSetupMode 
            ? 'Defina uma senha segura para o painel administrativo'
            : 'Entre com suas credenciais de administrador'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={isSetupMode ? handleFirstSetup : handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">
              {isSetupMode ? 'Nova Senha' : 'Senha'}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
              placeholder={isSetupMode ? 'Defina uma senha segura' : 'Digite sua senha'}
            />
          </div>

          {isSetupMode && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
                placeholder="Confirme sua senha"
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-11 bg-ride-gradient hover:opacity-90 transition-opacity" 
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              isSetupMode ? 'Configurar Senha' : 'Entrar'
            )}
          </Button>

          {!isSetupMode && (
            <div className="text-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSetupMode(true);
                  setError(null);
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                Redefinir senha
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
