import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Inbox,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect } from 'react';
import type { Pagination as PaginationData } from '../lib/types';

export function Button({
  className = '',
  variant = 'primary',
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const variants = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function FieldFrame({ label, hint, error, required, children }: PropsWithChildren<FieldProps>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-xs font-normal text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

const controlClass =
  'min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500';

export function Input({
  label,
  hint,
  error,
  required,
  className = '',
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      <input
        className={`${controlClass} ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

export function Select({
  label,
  hint,
  error,
  required,
  className = '',
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      <select
        className={`${controlClass} ${error ? 'border-rose-400' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  className = '',
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} required={required}>
      <textarea
        className={`${controlClass} min-h-24 resize-y ${error ? 'border-rose-400' : ''} ${className}`}
        {...props}
      />
    </FieldFrame>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <input
        aria-label="Tìm kiếm"
        className={`${controlClass} pl-9`}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, open]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-modal="true"
        className={`flex max-h-[92vh] w-full ${widths[size]} flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-2xl`}
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            aria-label="Đóng"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}

export function EmptyState({
  title = 'Chưa có dữ liệu',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center px-6 py-10 text-center">
      <div>
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
          <Inbox className="size-5" />
        </div>
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
      <CircleAlert className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold">Không thể tải dữ liệu</p>
        <p className="mt-0.5 text-sm">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          Thử lại
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse p-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="mb-3 h-12 rounded-lg bg-slate-100" key={index} />
      ))}
    </div>
  );
}

export function Pagination({
  value,
  onChange,
}: {
  value: PaginationData;
  onChange: (page: number) => void;
}) {
  if (value.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
      <span>
        Trang {value.page}/{value.totalPages} · {value.total} kết quả
      </span>
      <div className="flex gap-1">
        <button
          aria-label="Trang trước"
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
          disabled={value.page <= 1}
          onClick={() => onChange(value.page - 1)}
          type="button"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="Trang sau"
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-40"
          disabled={value.page >= value.totalPages}
          onClick={() => onChange(value.page + 1)}
          type="button"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function StatusBadge({
  tone,
  children,
}: PropsWithChildren<{ tone: 'green' | 'red' | 'amber' | 'blue' | 'slate' }>) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/15',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
    slate: 'bg-slate-100 text-slate-600 ring-slate-600/10',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors[tone]}`}
    >
      {children}
    </span>
  );
}
