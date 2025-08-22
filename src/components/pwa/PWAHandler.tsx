import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export const PWAHandler = () => {
  const { toast } = useToast();

  useEffect(() => {
    // Handle PWA update available
    const handleAppUpdate = () => {
      toast({
        title: "Atualização disponível",
        description: "Uma nova versão do app está disponível. Recarregue a página para atualizar.",
        duration: 10000,
      });
    };

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleAppUpdate);
      
      // Check for updates periodically
      setInterval(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.update();
          });
        });
      }, 60000); // Check every minute
    }

    // Handle online/offline status
    const handleOnline = () => {
      toast({
        title: "Conectado",
        description: "Conexão com a internet restaurada.",
      });
    };

    const handleOffline = () => {
      toast({
        title: "Modo offline",
        description: "Você está navegando no modo offline.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleAppUpdate);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  return null;
};