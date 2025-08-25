import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';

export const useAccessControl = () => {
  const { user, profile } = useAuth();
  const { hasActiveAccess, loading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Aguardar carregamento das informações
    if (subscriptionLoading || !user || !profile) return;

    // Só aplicar controle de acesso para motoristas
    if (profile.user_type !== 'driver') return;

    // Permitir acesso apenas à página de ganhos/assinatura quando bloqueado
    const allowedPaths = ['/driver/earnings', '/auth', '/'];
    const isOnAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));

    // Se não tem acesso ativo e não está em uma página permitida, redirecionar
    if (!hasActiveAccess() && !isOnAllowedPath) {
      navigate('/driver/earnings', { replace: true });
    }
  }, [user, profile, hasActiveAccess, subscriptionLoading, location.pathname, navigate]);

  return {
    hasActiveAccess: hasActiveAccess(),
    subscriptionLoading
  };
};