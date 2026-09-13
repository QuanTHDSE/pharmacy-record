import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ALLERGY_SEVERITIES, ALLERGY_TYPES } from '@pharmacy-records/shared';
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
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../contexts/use-auth';
import { useToast } from '../../contexts/use-toast';
import { api, errorMessage, toQuery } from '../../lib/api';
import {
  allergySeverityLabel,
  allergyTypeLabel,
  formatDate,
  toDateTimeInput,
} from '../../lib/format';
import type { Allergy, AllergySeverity, AllergyType, PageResult } from '../../lib/types';

interface AllergyForm {
  type: AllergyType;
  allergenName: string;
  reaction: string;
  severity: AllergySeverity;
  recordedAt: string;
  note: string;
}

const blankForm = (): AllergyForm => ({
  type: 'OTHER',
  allergenName: '',
  reaction: '',
  severity: 'UNKNOWN',
  recordedAt: toDateTimeInput(new Date().toISOString()),
  note: '',
});

export function PatientAllergiesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<Allergy> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | null>(null);
  const [deleting, setDeleting] = useState<Allergy | null>(null);
  const [form, setForm] = useState<AllergyForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api<PageResult<Allergy>>(
          `/patients/${patientId}/allergies${toQuery({ page, limit: 10, search: search.trim(), severity })}`,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, patientId, search, severity]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (item: Allergy) => {
    setEditing(item);
    setForm({
      type: item.type,
      allergenName: item.allergenName,
      reaction: item.reaction ?? '',
      severity: item.severity,
      recordedAt: toDateTimeInput(item.recordedAt),
      note: item.note ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      type: form.type,
      allergenName: form.allergenName,
      reaction: form.reaction || null,
      severity: form.severity,
      recordedAt: new Date(form.recordedAt).toISOString(),
      note: form.note || null,
    };
    try {
      await api(editing ? `/allergies/${editing.id}` : `/patients/${patientId}/allergies`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showToast(editing ? 'Đã cập nhật thông tin dị ứng.' : 'Đã ghi nhận dị ứng.');
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api(`/allergies/${deleting.id}`, { method: 'DELETE' });
      showToast('Đã xóa thông tin dị ứng.');
      setDeleting(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
        <SearchInput
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Tìm tác nhân hoặc phản ứng…"
          value={search}
        />
        <select
          aria-label="Mức độ dị ứng"
          className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600"
          onChange={(event) => {
            setSeverity(event.target.value);
            setPage(1);
          }}
          value={severity}
        >
          <option value="">Tất cả mức độ</option>
          {ALLERGY_SEVERITIES.map((item) => (
            <option key={item} value={item}>
              {allergySeverityLabel[item]}
            </option>
          ))}
        </select>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Thêm dị ứng
        </Button>
      </header>
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingState rows={4} />
      ) : !result?.items.length ? (
        <EmptyState
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Ghi nhận dị ứng
            </Button>
          }
          description="Lưu tác nhân, phản ứng và mức độ để hỗ trợ cấp thuốc an toàn."
          title="Chưa ghi nhận dị ứng"
        />
      ) : (
        <>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {result.items.map((item) => (
              <article
                className={`rounded-xl border p-4 ${item.severity === 'SEVERE' ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'}`}
                key={item.id}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${item.severity === 'SEVERE' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    <AlertTriangle className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-800">{item.allergenName}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {allergyTypeLabel[item.type]} · Ghi nhận {formatDate(item.recordedAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${severityClass[item.severity]}`}
                      >
                        {allergySeverityLabel[item.severity]}
                      </span>
                    </div>
                    {item.reaction && (
                      <p className="mt-3 text-sm text-slate-600">
                        <strong>Phản ứng:</strong> {item.reaction}
                      </p>
                    )}
                    {item.note && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.note}</p>
                    )}
                    <div className="mt-3 flex justify-end gap-1">
                      <button
                        aria-label="Chỉnh sửa"
                        className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-emerald-700"
                        onClick={() => openEdit(item)}
                        type="button"
                      >
                        <Pencil className="size-4" />
                      </button>
                      {user?.role === 'ADMIN' && (
                        <button
                          aria-label="Xóa"
                          className="rounded-lg p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-700"
                          onClick={() => setDeleting(item)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination onChange={setPage} value={result.pagination} />
        </>
      )}

      <Modal
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} variant="secondary">
              Hủy
            </Button>
            <Button form="allergy-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Ghi nhận'}
            </Button>
          </>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title={editing ? 'Cập nhật dị ứng' : 'Ghi nhận dị ứng'}
      >
        <form className="grid gap-4" id="allergy-form" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Loại dị ứng"
              onChange={(event) => setForm({ ...form, type: event.target.value as AllergyType })}
              required
              value={form.type}
            >
              {ALLERGY_TYPES.map((item) => (
                <option key={item} value={item}>
                  {allergyTypeLabel[item]}
                </option>
              ))}
            </Select>
            <Select
              label="Mức độ"
              onChange={(event) =>
                setForm({ ...form, severity: event.target.value as AllergySeverity })
              }
              required
              value={form.severity}
            >
              {ALLERGY_SEVERITIES.map((item) => (
                <option key={item} value={item}>
                  {allergySeverityLabel[item]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Tác nhân gây dị ứng"
            maxLength={200}
            minLength={1}
            onChange={(event) => setForm({ ...form, allergenName: event.target.value })}
            placeholder="Ví dụ: Penicillin, hải sản…"
            required
            value={form.allergenName}
          />
          <Textarea
            label="Phản ứng"
            maxLength={2000}
            onChange={(event) => setForm({ ...form, reaction: event.target.value })}
            placeholder="Phát ban, khó thở…"
            value={form.reaction}
          />
          <Input
            label="Thời điểm ghi nhận"
            max={toDateTimeInput(new Date().toISOString())}
            onChange={(event) => setForm({ ...form, recordedAt: event.target.value })}
            required
            type="datetime-local"
            value={form.recordedAt}
          />
          <Textarea
            label="Ghi chú"
            maxLength={5000}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            value={form.note}
          />
          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </form>
      </Modal>
      <Modal
        footer={
          <>
            <Button onClick={() => setDeleting(null)} variant="secondary">
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void remove()} variant="danger">
              Xóa
            </Button>
          </>
        }
        onClose={() => setDeleting(null)}
        open={Boolean(deleting)}
        size="sm"
        title="Xóa thông tin dị ứng"
      >
        <p className="text-sm text-slate-600">
          Xóa ghi nhận dị ứng với “{deleting?.allergenName}” khỏi hồ sơ đang hoạt động?
        </p>
      </Modal>
    </section>
  );
}

const severityClass: Record<AllergySeverity, string> = {
  UNKNOWN: 'bg-slate-100 text-slate-600',
  MILD: 'bg-sky-100 text-sky-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  SEVERE: 'bg-rose-100 text-rose-700',
};
