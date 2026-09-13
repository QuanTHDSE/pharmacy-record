import { useContext } from 'react';
import { ToastContext } from './toast-store';
import type { ToastContextValue } from './toast-store';

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast phải được sử dụng bên trong ToastProvider.');
  return context;
}
