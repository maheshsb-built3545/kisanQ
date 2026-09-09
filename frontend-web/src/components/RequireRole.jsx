import { useAuth } from '../hooks/useAuth';

export function RequireRole({ roles, children, fallback = null }) {
  const { hasRole } = useAuth();

  if (!hasRole(roles)) {
    return fallback;
  }

  return children;
}
