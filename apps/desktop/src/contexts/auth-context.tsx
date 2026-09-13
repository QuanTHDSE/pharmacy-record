import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { api, hasAccessToken, setAccessToken } from '../lib/api';
import type { AuthUser, LoginResponse } from '../lib/types';
import { AuthContext } from './auth-store';
import type { AuthContextValue } from './auth-store';

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBooting, setIsBooting] = useState(hasAccessToken());

  useEffect(() => {
    if (!hasAccessToken()) return;

    let active = true;
    api<AuthUser>('/auth/me')
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => setAccessToken(null))
      .finally(() => {
        if (active) setIsBooting(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('pharmacy:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('pharmacy:unauthorized', handleUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBooting,
      login: async (email, password) => {
        const response = await api<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        setAccessToken(response.accessToken);
        setUser(response.user);
      },
      logout: () => {
        setAccessToken(null);
        setUser(null);
      },
    }),
    [isBooting, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
