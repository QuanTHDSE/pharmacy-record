import { ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GENDERS } from '@pharmacy-records/shared';
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
} from '../components/ui';
import { useAuth } from '../contexts/use-auth';
import { useToast } from '../contexts/use-toast';
import { api, errorMessage, toQuery } from '../lib/api';
import { calculateAge, formatDate, genderLabel, toDateInput } from '../lib/format';
import type { Gender, PageResult, Patient } from '../lib/types';

interface PatientForm {
  fullName: string;
  dateOfBirth: string;
  gender: '' | Gender;
  phone: string;
  address: string;
  note: string;
}

const emptyForm: PatientForm = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  address: '',
  note: '',
};

export function PatientsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<Patient> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [gender, setGender] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionTarget, setActionTarget] = useState<Patient | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Patient | null>(null);
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = deleted ? '/patients/deleted' : '/patients';
      const data = await api<PageResult<Patient>>(
        `${path}${toQuery({ page, limit: 12, search: debouncedSearch, gender })}`,
      );
      setResult(data);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, deleted, gender, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (patient: Patient) => {
    setEditing(patient);
    setForm({
      fullName: patient.fullName,
      dateOfBirth: toDateInput(patient.dateOfBirth),
      gender: patient.gender ?? '',
      phone: patient.phone ?? '',
      address: patient.address ?? '',
      note: patient.note ?? '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      fullName: form.fullName,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender || null,
      phone: form.phone || null,
      address: form.address || null,
      note: form.note || null,
    };
    try {
      if (editing) {
        await api(`/patients/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        showToast('Đã cập nhật thông tin bệnh nhân.');
      } else {
        await api('/patients', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Đã thêm bệnh nhân mới.');
      }
      setFormOpen(false);
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    setSaving(true);
    try {
      if (deleted) {
        await api(`/patients/${actionTarget.id}/restore`, { method: 'PATCH' });
        showToast('Đã khôi phục bệnh nhân.');
      } else {
        await api(`/patients/${actionTarget.id}`, { method: 'DELETE' });
        showToast('Đã chuyển bệnh nhân vào danh sách đã xóa.');
      }
      setActionTarget(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setSaving(true);
    try {
      await api(`/patients/${permanentDeleteTarget.id}/permanent`, { method: 'DELETE' });
      showToast('Đã xóa vĩnh viễn bệnh nhân và toàn bộ dữ liệu liên quan.');
      setPermanentDeleteTarget(null);
      if (result?.items.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        await load();
      }
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
            Hồ sơ chăm sóc
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Quản lý bệnh nhân
          </h1>
          <p className="mt-1 text-sm text-slate-500">Tra cứu theo mã, họ tên hoặc số điện thoại.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                setDeleted((value) => !value);
                setPage(1);
              }}
              variant="secondary"
            >
              <ArchiveRestore className="size-4" /> {deleted ? 'Danh sách hoạt động' : 'Đã xóa'}
            </Button>
          )}
          {!deleted && (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Thêm bệnh nhân
            </Button>
          )}
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <SearchInput
            onChange={setSearch}
            placeholder="Nhập mã, họ tên hoặc số điện thoại…"
            value={search}
          />
          <select
            aria-label="Lọc giới tính"
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => {
              setGender(event.target.value);
              setPage(1);
            }}
            value={gender}
          >
            <option value="">Tất cả giới tính</option>
            {GENDERS.map((item) => (
              <option key={item} value={item}>
                {genderLabel[item]}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <LoadingState rows={8} />
        ) : !result?.items.length ? (
          <EmptyState
            action={
              !deleted ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> Thêm bệnh nhân đầu tiên
                </Button>
              ) : undefined
            }
            description={
              debouncedSearch
                ? 'Hãy thử từ khóa hoặc bộ lọc khác.'
                : deleted
                  ? 'Không có bệnh nhân nào trong danh sách đã xóa.'
                  : 'Bắt đầu bằng cách tạo hồ sơ bệnh nhân.'
            }
            title={debouncedSearch ? 'Không tìm thấy bệnh nhân' : 'Chưa có bệnh nhân'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Bệnh nhân</th>
                    <th className="px-4 py-3">Ngày sinh</th>
                    <th className="px-4 py-3">Giới tính</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3">Cập nhật</th>
                    <th className="w-24 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((patient) => (
                    <tr className="group hover:bg-emerald-50/35" key={patient.id}>
                      <td className="px-5 py-3.5">
                        <Link
                          className="flex items-center gap-3"
                          to={deleted ? '#' : `/patients/${patient.id}`}
                        >
                          <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 font-bold text-emerald-800">
                            {patient.fullName.charAt(0)}
                          </span>
                          <span>
                            <span className="block font-semibold text-slate-800 group-hover:text-emerald-800">
                              {patient.fullName}
                            </span>
                            <span className="mt-0.5 block font-mono text-xs text-slate-400">
                              {patient.patientCode}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block text-slate-700">
                          {formatDate(patient.dateOfBirth)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {calculateAge(patient.dateOfBirth)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {patient.gender ? genderLabel[patient.gender] : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block text-slate-700">{patient.phone ?? '—'}</span>
                        <span className="block max-w-52 truncate text-xs text-slate-400">
                          {patient.address ?? 'Chưa có địa chỉ'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(patient.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        {deleted ? (
                          <div className="flex items-center gap-1">
                            <button
                              aria-label="Khôi phục"
                              className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"
                              onClick={() => setActionTarget(patient)}
                              title="Khôi phục"
                              type="button"
                            >
                              <ArchiveRestore className="size-4" />
                            </button>
                            <button
                              aria-label="Xóa vĩnh viễn"
                              className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => setPermanentDeleteTarget(patient)}
                              title="Xóa vĩnh viễn"
                              type="button"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              aria-label="Chỉnh sửa"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => openEdit(patient)}
                              type="button"
                            >
                              <Pencil className="size-4" />
                            </button>
                            {isAdmin && (
                              <button
                                aria-label="Xóa"
                                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => setActionTarget(patient)}
                                type="button"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                            {!isAdmin && <MoreHorizontal className="size-4 text-slate-300" />}
                          </div>
                        )}
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
        footer={
          <>
            <Button onClick={() => setFormOpen(false)} type="button" variant="secondary">
              Hủy
            </Button>
            <Button form="patient-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Tạo bệnh nhân'}
            </Button>
          </>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        size="lg"
        title={editing ? 'Cập nhật bệnh nhân' : 'Thêm bệnh nhân'}
      >
        <form className="grid gap-4" id="patient-form" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên"
              maxLength={150}
              minLength={2}
              onChange={(event) => setForm({ ...form, fullName: event.target.value })}
              placeholder="Nguyễn Văn An"
              required
              value={form.fullName}
            />
            <Input
              label="Ngày sinh"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
              type="date"
              value={form.dateOfBirth}
            />
            <Select
              label="Giới tính"
              onChange={(event) =>
                setForm({ ...form, gender: event.target.value as PatientForm['gender'] })
              }
              value={form.gender}
            >
              <option value="">Chưa cập nhật</option>
              {GENDERS.map((item) => (
                <option key={item} value={item}>
                  {genderLabel[item]}
                </option>
              ))}
            </Select>
            <Input
              label="Số điện thoại"
              maxLength={20}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              pattern="[0-9+().\s\-]{7,20}"
              placeholder="0901234567"
              value={form.phone}
            />
            <Input
              label="Địa chỉ"
              maxLength={500}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="Địa chỉ liên hệ"
              value={form.address}
            />
          </div>
          <Textarea
            label="Ghi chú"
            maxLength={5000}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
            placeholder="Thông tin cần lưu ý…"
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
            <Button onClick={() => setActionTarget(null)} variant="secondary">
              Hủy
            </Button>
            <Button
              loading={saving}
              onClick={() => void confirmAction()}
              variant={deleted ? 'primary' : 'danger'}
            >
              {deleted ? 'Khôi phục' : 'Xóa bệnh nhân'}
            </Button>
          </>
        }
        onClose={() => setActionTarget(null)}
        open={Boolean(actionTarget)}
        size="sm"
        title={deleted ? 'Khôi phục bệnh nhân' : 'Xóa bệnh nhân'}
      >
        <p className="text-sm leading-6 text-slate-600">
          {deleted
            ? `Khôi phục hồ sơ của ${actionTarget?.fullName} về danh sách hoạt động?`
            : `Hồ sơ của ${actionTarget?.fullName} sẽ được xóa mềm và có thể khôi phục sau.`}
        </p>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setPermanentDeleteTarget(null)} variant="secondary">
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void confirmPermanentDelete()} variant="danger">
              Xóa vĩnh viễn
            </Button>
          </>
        }
        onClose={() => setPermanentDeleteTarget(null)}
        open={Boolean(permanentDeleteTarget)}
        size="sm"
        title="Xóa vĩnh viễn bệnh nhân"
      >
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <p>
            Xóa vĩnh viễn hồ sơ của{' '}
            <strong className="font-semibold text-slate-900">
              {permanentDeleteTarget?.fullName}
            </strong>
            ?
          </p>
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">
            Toàn bộ hồ sơ y tế, bệnh lý, dị ứng và ảnh đính kèm sẽ bị xóa. Thao tác này không thể
            hoàn tác.
          </p>
        </div>
      </Modal>
    </div>
  );
}
