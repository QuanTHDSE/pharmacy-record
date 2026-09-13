import { CalendarDays, Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DISEASE_STATUSES } from '@pharmacy-records/shared';
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
import { diseaseStatusLabel, formatDate, toDateInput } from '../../lib/format';
import type { Disease, DiseaseStatus, PageResult, PatientDisease } from '../../lib/types';

interface DiseaseForm {
  diseaseId: string;
  status: DiseaseStatus;
  diagnosedAt: string;
  resolvedAt: string;
  note: string;
}

const blankForm: DiseaseForm = {
  diseaseId: '',
  status: 'ACTIVE',
  diagnosedAt: '',
  resolvedAt: '',
  note: '',
};

export function PatientDiseasesTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<PatientDisease> | null>(null);
  const [catalog, setCatalog] = useState<Disease[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PatientDisease | null>(null);
  const [deleting, setDeleting] = useState<PatientDisease | null>(null);
  const [form, setForm] = useState<DiseaseForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [items, diseaseCatalog] = await Promise.all([
        api<PageResult<PatientDisease>>(
          `/patients/${patientId}/diseases${toQuery({ page, limit: 10, search: search.trim(), status })}`,
        ),
        api<PageResult<Disease>>(`/diseases${toQuery({ page: 1, limit: 100, isActive: true })}`),
      ]);
      setResult(items);
      setCatalog(diseaseCatalog.items);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, patientId, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (item: PatientDisease) => {
    setEditing(item);
    setForm({
      diseaseId: item.diseaseId,
      status: item.status,
      diagnosedAt: toDateInput(item.diagnosedAt),
      resolvedAt: toDateInput(item.resolvedAt),
      note: item.note ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const updateStatus = (next: DiseaseStatus) => {
    setForm({ ...form, status: next, resolvedAt: next === 'RESOLVED' ? form.resolvedAt : '' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const common = {
      status: form.status,
      diagnosedAt: form.diagnosedAt || null,
      resolvedAt: form.status === 'RESOLVED' ? form.resolvedAt || null : null,
      note: form.note || null,
    };
    try {
      await api(editing ? `/patient-diseases/${editing.id}` : `/patients/${patientId}/diseases`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(editing ? common : { ...common, diseaseId: form.diseaseId }),
      });
      showToast(editing ? 'Đã cập nhật tình trạng bệnh lý.' : 'Đã ghi nhận bệnh lý.');
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
      await api(`/patient-diseases/${deleting.id}`, { method: 'DELETE' });
      showToast('Đã xóa bệnh lý khỏi hồ sơ bệnh nhân.');
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
          placeholder="Tìm tên hoặc mã bệnh lý…"
          value={search}
        />
        <select
          aria-label="Trạng thái bệnh lý"
          className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600"
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          value={status}
        >
          <option value="">Tất cả trạng thái</option>
          {DISEASE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {diseaseStatusLabel[item]}
            </option>
          ))}
        </select>
        <Button disabled={!catalog.length} onClick={openCreate}>
          <Plus className="size-4" /> Thêm bệnh lý
        </Button>
      </header>
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingState rows={4} />
      ) : !result?.items.length ? (
        <EmptyState
          action={
            catalog.length ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Ghi nhận bệnh lý
              </Button>
            ) : undefined
          }
          description={
            catalog.length
              ? 'Theo dõi bệnh đang điều trị, mạn tính hoặc đã khỏi.'
              : 'Quản trị viên cần tạo danh mục bệnh lý trước.'
          }
          title="Chưa ghi nhận bệnh lý"
        />
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {result.items.map((item) => (
              <article className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50" key={item.id}>
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
                  <Stethoscope className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800">
                        {item.disease?.name ?? 'Bệnh lý'}
                      </h3>
                      <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {item.disease?.code ?? 'Không có mã'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass[item.status]}`}
                    >
                      {diseaseStatusLabel[item.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> Chẩn đoán:{' '}
                      {formatDate(item.diagnosedAt)}
                    </span>
                    {item.resolvedAt && <span>Khỏi bệnh: {formatDate(item.resolvedAt)}</span>}
                    <span>Ghi nhận bởi {item.recordedByUser?.fullName ?? 'Nhân viên'}</span>
                  </div>
                  {item.note && <p className="mt-2 text-sm text-slate-600">{item.note}</p>}
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label="Chỉnh sửa"
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"
                    onClick={() => openEdit(item)}
                    type="button"
                  >
                    <Pencil className="size-4" />
                  </button>
                  {user?.role === 'ADMIN' && (
                    <button
                      aria-label="Xóa"
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setDeleting(item)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
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
            <Button form="patient-disease-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Ghi nhận'}
            </Button>
          </>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title={editing ? 'Cập nhật bệnh lý' : 'Ghi nhận bệnh lý'}
      >
        <form className="grid gap-4" id="patient-disease-form" onSubmit={submit}>
          <Select
            disabled={Boolean(editing)}
            label="Bệnh lý"
            onChange={(event) => setForm({ ...form, diseaseId: event.target.value })}
            required
            value={form.diseaseId}
          >
            <option value="">Chọn bệnh lý</option>
            {catalog.map((disease) => (
              <option key={disease.id} value={disease.id}>
                {disease.code ? `${disease.code} — ` : ''}
                {disease.name}
              </option>
            ))}
          </Select>
          <Select
            label="Tình trạng"
            onChange={(event) => updateStatus(event.target.value as DiseaseStatus)}
            required
            value={form.status}
          >
            {DISEASE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {diseaseStatusLabel[item]}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Ngày chẩn đoán"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setForm({ ...form, diagnosedAt: event.target.value })}
              type="date"
              value={form.diagnosedAt}
            />
            <Input
              disabled={form.status !== 'RESOLVED'}
              label="Ngày khỏi bệnh"
              max={new Date().toISOString().slice(0, 10)}
              min={form.diagnosedAt || undefined}
              onChange={(event) => setForm({ ...form, resolvedAt: event.target.value })}
              required={form.status === 'RESOLVED'}
              type="date"
              value={form.resolvedAt}
            />
          </div>
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
        title="Xóa bệnh lý"
      >
        <p className="text-sm text-slate-600">
          Xóa “{deleting?.disease?.name}” khỏi hồ sơ bệnh nhân?
        </p>
      </Modal>
    </section>
  );
}

const statusClass: Record<DiseaseStatus, string> = {
  ACTIVE: 'bg-amber-100 text-amber-700',
  CHRONIC: 'bg-violet-100 text-violet-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
};
