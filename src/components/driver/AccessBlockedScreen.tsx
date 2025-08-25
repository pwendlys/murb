import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';

export const AccessBlockedScreen = () => {
  const navigate = useNavigate();
  const { subscriptionStatus, getStatusMessage } = useSubscription();

  const handleGoToSubscriptions = () => {
    navigate('/driver/earnings');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">
            Acesso Bloqueado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <Badge variant="destructive" className="mb-3">
              {subscriptionStatus?.status === 'vencida' ? 'Assinatura Vencida' : 'Acesso Bloqueado'}
            </Badge>
            <p className="text-muted-foreground">
              {getStatusMessage()}
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Para recuperar o acesso:
            </h4>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Clique no botão abaixo para ir à área de assinaturas</li>
              <li>Escolha um plano de renovação</li>
              <li>Solicite a renovação pelo app</li>
              <li>Aguarde a confirmação do pagamento pelo administrador</li>
            </ol>
          </div>

          <Button 
            onClick={handleGoToSubscriptions}
            className="w-full"
            size="lg"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Ir para Assinaturas
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Todo o processo de renovação é feito pelo app. 
            Não é necessário contato externo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};