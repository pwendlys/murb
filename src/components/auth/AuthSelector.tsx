
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bike, Shield, Users } from 'lucide-react';
import { AuthForm } from './AuthForm';
import { AdminAuth } from './AdminAuth';

export const AuthSelector = () => {
  const [authType, setAuthType] = useState<'select' | 'user' | 'admin'>('select');

  if (authType === 'user') {
    return <AuthForm onBack={() => setAuthType('select')} />;
  }

  if (authType === 'admin') {
    return <AdminAuth />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Bike className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">RideBuddy</h1>
          <p className="text-muted-foreground">Conectando passageiros e motoristas</p>
        </div>

        <Card className="shadow-ride-card border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Escolha o tipo de acesso</CardTitle>
            <CardDescription className="text-center">
              Selecione como deseja acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => setAuthType('user')}
              variant="outline"
              className="w-full h-16 flex items-center justify-start space-x-4 border-2 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Usuário</div>
                <div className="text-sm text-muted-foreground">Passageiro ou Mototaxista</div>
              </div>
            </Button>

            <Button
              onClick={() => setAuthType('admin')}
              variant="outline"
              className="w-full h-16 flex items-center justify-start space-x-4 border-2 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-amber-500/10 rounded-xl">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Administrador</div>
                <div className="text-sm text-muted-foreground">Painel administrativo</div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
