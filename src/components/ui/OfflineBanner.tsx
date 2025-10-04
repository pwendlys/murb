import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { Button } from '@/components/ui/button';
import { logTelemetry } from '@/lib/telemetry';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const flags = useFeatureFlags();

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('[Offline] Conexão restaurada');
    };

    const handleOffline = () => {
      setIsOffline(true);
      logTelemetry({ event: 'offline_mode_used', data: { page: window.location.pathname } });
      console.log('[Offline] Modo offline ativado');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!flags.offlineCache || !isOffline) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Você está offline. Exibindo informações recentes. Algumas ações foram desativadas.
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="ml-4"
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Tentar Atualizar
        </Button>
      </div>
    </Alert>
  );
};
