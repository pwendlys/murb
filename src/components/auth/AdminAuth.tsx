
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, AlertCircle } from 'lucide-react';
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
      
      const { data, error } = await supabase
        .from('admin_setup')
        .select('password_set')
        .limit(1)
        .single();

      console.log('Admin setup check result:', { data, error });

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin setup:', error);
        setIsSetupMode(true);
      } else if (data?.password_set) {
        console.log('Admin already configured, showing login mode');
        setIsSetupMode(false);
      } else {
        console.log('Admin not configured, showing setup mode');
        setIsSetupMode(true);
      }
    } catch (error) {
      console.error('Error checking admin setup:', error);
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
        <CardTitle className="text-2xl font-bold text-center">
          {isSetupMode ? 'Configurar Administrador' : 'Login Admin'}
        </CardTitle>
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
