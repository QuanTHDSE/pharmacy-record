import { ChevronRight, Filter, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Pagination,
  SearchInput,
  Select,
} from '../components/ui';
import { api, errorMessage, toQuery } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AuditLog, PageResult } from '../lib/types';

interface FilterOptions {
  actions: string[];
  entityTypes: string[];
}

const actionLabels: Record<string, string> = {
  AUTH_LOGIN_SUCCEEDED: 'Đăng nhập thành công',
  AUTH_LOGIN_FAILED: 'Đăng nhập thất bại',
  USER_CREATED: 'Tạo người dùng',
  USER_UPDATED: 'Cập nhật người dùng',
  USER_STATUS_CHANGED: 'Đổi trạng thái người dùng',
  USER_PASSWORD_RESET: 'Đặt lại mật khẩu',
  PATIENT_CREATED: 'Tạo bệnh nhân',
  PATIENT_UPDATED: 'Cập nhật bệnh nhân',
  PATIENT_DELETED: 'Xóa bệnh nhân',
  PATIENT_RESTORED: 'Khôi phục bệnh nhân',
  PATIENT_PERMANENTLY_DELETED: 'Xóa vĩnh viễn bệnh nhân',
  MEDICAL_RECORD_CREATED: 'Tạo hồ sơ y tế',
  MEDICAL_RECORD_UPDATED: 'Cập nhật hồ sơ y tế',
  MEDICAL_RECORD_DELETED: 'Xóa hồ sơ y tế',
  ALLERGY_CREATED: 'Ghi nhận dị ứng',
  ALLERGY_UPDATED: 'Cập nhật dị ứng',
  ALLERGY_DELETED: 'Xóa dị ứng',
  DISEASE_CREATED: 'Tạo bệnh lý',
  DISEASE_UPDATED: 'Cập nhật bệnh lý',
  DISEASE_STATUS_CHANGED: 'Đổi trạng thái bệnh lý',
  PATIENT_DISEASE_CREATED: 'Ghi nhận bệnh lý bệnh nhân',
  PATIENT_DISEASE_UPDATED: 'Cập nhật bệnh lý bệnh nhân',
  PATIENT_DISEASE_DELETED: 'Xóa bệnh lý bệnh nhân',
};

export function AuditLogsPage() {
  const [result, setResult] = useState<PageResult<AuditLog> | null>(null);
  const [options, setOptions] = useState<FilterOptions>({ actions: [], entityTypes: [] });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [logs, filterOptions] = await Promise.all([
        api<PageResult<AuditLog>>(
          `/audit-logs${toQuery({
            page,
            limit: 15,
            search: search.trim(),
            action,
            entityType,
            from: from ? new Date(`${from}T00:00:00`).toISOString() : '',
            to: to ? new Date(`${to}T23:59:59.999`).toISOString() : '',
          })}`,
        ),
        api<FilterOptions>('/audit-logs/filter-options'),
      ]);
      setResult(logs);
      setOptions(filterOptions);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [action, entityType, from, page, search, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const reset = () => {
    setSearch('');
    setAction('');
    setEntityType('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const hasFilters = Boolean(search || action || entityType || from || to);

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Giám sát và truy vết
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Nhật ký hệ thống
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi các thao tác quan trọng và thay đổi dữ liệu.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="size-4" /> Chỉ đọc · Chỉ Admin
        </div>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm hành động, người dùng hoặc thiết bị…"
            value={search}
          />
          <Button
            onClick={() => setShowFilters((value) => !value)}
            variant={showFilters ? 'primary' : 'secondary'}
          >
            <Filter className="size-4" /> Bộ lọc
          </Button>
          {hasFilters && (
            <Button onClick={reset} variant="ghost">
              <RotateCcw className="size-4" /> Xóa lọc
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Hành động"
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              value={action}
            >
              <option value="">Tất cả</option>
              {options.actions.map((item) => (
                <option key={item} value={item}>
                  {actionLabels[item] ?? item}
                </option>
              ))}
            </Select>
            <Select
              label="Loại dữ liệu"
              onChange={(event) => {
                setEntityType(event.target.value);
                setPage(1);
              }}
              value={entityType}
            >
              <option value="">Tất cả</option>
              {options.entityTypes.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
            <Input
              label="Từ ngày"
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={from}
            />
            <Input
              label="Đến ngày"
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={to}
            />
          </div>
        )}
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <LoadingState rows={9} />
        ) : !result?.items.length ? (
          <EmptyState
            description="Không có sự kiện phù hợp với bộ lọc hiện tại."
            title="Chưa có nhật ký"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Thời gian</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Người thực hiện</th>
                    <th className="px-4 py-3">Đối tượng</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((log) => (
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      key={log.id}
                      onClick={() => setSelected(log)}
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">
                        {formatDateTime(log.occurredAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${actionTone(log.action)}`}
                        >
                          {actionLabels[log.action] ?? log.action.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-medium text-slate-700">
                          {log.actorUser?.fullName ?? 'Hệ thống / Không xác định'}
                        </span>
                        {log.actorUser?.email && (
                          <span className="block text-xs text-slate-400">
                            {log.actorUser.email}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block text-xs font-semibold text-slate-600">
                          {log.entityType.replaceAll('_', ' ')}
                        </span>
                        <span className="block max-w-40 truncate font-mono text-[10px] text-slate-400">
                          {log.entityId ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        {log.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <ChevronRight className="size-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination onChange={setPage} value={result.pagination} />
          </>
        )}
      </section>
      <Modal
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        size="lg"
        title="Chi tiết sự kiện"
      >
        <div className="grid gap-5">
          <div className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
            <Detail label="Mã nhật ký" value={selected?.id} />
            <Detail label="Thời gian" value={formatDateTime(selected?.occurredAt)} />
            <Detail
              label="Hành động"
              value={selected ? (actionLabels[selected.action] ?? selected.action) : ''}
            />
            <Detail label="Loại dữ liệu" value={selected?.entityType} />
            <Detail
              label="Người thực hiện"
              value={selected?.actorUser?.fullName ?? 'Không xác định'}
            />
            <Detail label="Địa chỉ IP" value={selected?.ipAddress ?? '—'} />
            <Detail label="Entity ID" value={selected?.entityId ?? '—'} />
            <Detail label="Request ID" value={selected?.requestId ?? '—'} />
          </div>
          <JsonBlock label="Dữ liệu trước thay đổi" value={selected?.oldValues} />
          <JsonBlock label="Dữ liệu sau thay đổi" value={selected?.newValues} />
          <JsonBlock label="Metadata" value={selected?.metadata} />
        </div>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-medium text-slate-700">{value || '—'}</p>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-xl bg-slate-900 p-4 text-xs leading-5 text-emerald-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function actionTone(action: string): string {
  if (action.includes('FAILED') || action.includes('DELETED')) return 'bg-rose-50 text-rose-700';
  if (action.includes('CREATED') || action.includes('SUCCEEDED') || action.includes('RESTORED'))
    return 'bg-emerald-50 text-emerald-700';
  return 'bg-sky-50 text-sky-700';
}
