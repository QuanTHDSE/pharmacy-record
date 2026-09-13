import { useContext } from 'react';
import { AuthContext } from './auth-store';
import type { AuthContextValue } from './auth-store';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  return context;
}
