import { CircleCheck, CircleOff, Pencil, Plus, Stethoscope } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Pagination,
  SearchInput,
  Textarea,
} from '../components/ui';
import { useAuth } from '../contexts/use-auth';
import { useToast } from '../contexts/use-toast';
import { api, errorMessage, toQuery } from '../lib/api';
import { formatDate } from '../lib/format';
import type { Disease, PageResult } from '../lib/types';

interface DiseaseForm {
  code: string;
  name: string;
  description: string;
}

const blankForm: DiseaseForm = { code: '', name: '', description: '' };

export function DiseasesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<Disease> | null>(null);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(true);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Disease | null>(null);
  const [statusTarget, setStatusTarget] = useState<Disease | null>(null);
  const [form, setForm] = useState<DiseaseForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api<PageResult<Disease>>(
          `/diseases${toQuery({ page, limit: 12, search: search.trim(), isActive: active })}`,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [active, page, search]);

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

  const openEdit = (disease: Disease) => {
    setEditing(disease);
    setForm({
      code: disease.code ?? '',
      name: disease.name,
      description: disease.description ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      code: form.code || null,
      name: form.name,
      description: form.description || null,
    };
    try {
      await api(editing ? `/diseases/${editing.id}` : '/diseases', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showToast(editing ? 'Đã cập nhật bệnh lý.' : 'Đã thêm bệnh lý vào danh mục.');
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    setSaving(true);
    try {
      await api(`/diseases/${statusTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !statusTarget.isActive }),
      });
      showToast(statusTarget.isActive ? 'Đã ngừng sử dụng bệnh lý.' : 'Đã kích hoạt bệnh lý.');
      setStatusTarget(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Danh mục dùng chung
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Bệnh lý</h1>
          <p className="mt-1 text-sm text-slate-500">
            Chuẩn hóa tên và mã bệnh lý trong hồ sơ bệnh nhân.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Thêm bệnh lý
          </Button>
        )}
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm theo mã hoặc tên bệnh lý…"
            value={search}
          />
          <div className="flex rounded-lg bg-slate-100 p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              onClick={() => {
                setActive(true);
                setPage(1);
              }}
              type="button"
            >
              Đang dùng
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${!active ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              onClick={() => {
                setActive(false);
                setPage(1);
              }}
              type="button"
            >
              Ngừng dùng
            </button>
          </div>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <LoadingState rows={7} />
        ) : !result?.items.length ? (
          <EmptyState
            action={
              isAdmin && active ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> Thêm bệnh lý
                </Button>
              ) : undefined
            }
            description="Không có dữ liệu phù hợp với bộ lọc hiện tại."
            title="Chưa có bệnh lý"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Mã</th>
                    <th className="px-4 py-3">Tên bệnh lý</th>
                    <th className="px-4 py-3">Mô tả</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    {isAdmin && <th className="w-28 px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((disease) => (
                    <tr className="hover:bg-slate-50" key={disease.id}>
                      <td className="px-5 py-3.5">
                        <span className="rounded-md bg-violet-50 px-2 py-1 font-mono text-xs font-bold text-violet-700">
                          {disease.code ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="size-4 text-emerald-600" />
                          <span className="font-semibold text-slate-800">{disease.name}</span>
                        </div>
                      </td>
                      <td className="max-w-md px-4 py-3.5 text-slate-500">
                        <p className="line-clamp-2">{disease.description || 'Chưa có mô tả'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(disease.createdAt)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button
                              aria-label="Chỉnh sửa"
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"
                              onClick={() => openEdit(disease)}
                              type="button"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              aria-label={disease.isActive ? 'Ngừng sử dụng' : 'Kích hoạt'}
                              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => setStatusTarget(disease)}
                              type="button"
                            >
                              {disease.isActive ? (
                                <CircleOff className="size-4" />
                              ) : (
                                <CircleCheck className="size-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      )}
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
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} variant="secondary">
              Hủy
            </Button>
            <Button form="disease-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Tạo bệnh lý'}
            </Button>
          </>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title={editing ? 'Cập nhật bệnh lý' : 'Thêm bệnh lý'}
      >
        <form className="grid gap-4" id="disease-form" onSubmit={submit}>
          <Input
            label="Mã bệnh lý"
            maxLength={30}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            pattern="[A-Z0-9][A-Z0-9._\-]{0,29}"
            placeholder="Ví dụ: I10"
            value={form.code}
          />
          <Input
            label="Tên bệnh lý"
            maxLength={200}
            minLength={2}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
          <Textarea
            label="Mô tả"
            maxLength={5000}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            value={form.description}
          />
          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </form>
      </Modal>
      <Modal
        footer={
          <>
            <Button onClick={() => setStatusTarget(null)} variant="secondary">
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void changeStatus()}>
              {statusTarget?.isActive ? 'Ngừng sử dụng' : 'Kích hoạt'}
            </Button>
          </>
        }
        onClose={() => setStatusTarget(null)}
        open={Boolean(statusTarget)}
        size="sm"
        title={statusTarget?.isActive ? 'Ngừng sử dụng bệnh lý' : 'Kích hoạt bệnh lý'}
      >
        <p className="text-sm leading-6 text-slate-600">
          {statusTarget?.isActive
            ? `“${statusTarget.name}” sẽ không còn xuất hiện khi ghi nhận bệnh lý mới. Dữ liệu cũ được giữ nguyên.`
            : `Cho phép sử dụng lại “${statusTarget?.name}” trong hồ sơ bệnh nhân.`}
        </p>
      </Modal>
    </div>
  );
}
