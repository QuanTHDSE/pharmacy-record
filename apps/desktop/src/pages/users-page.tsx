import { KeyRound, Pencil, Plus, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { USER_ROLES } from '@pharmacy-records/shared';
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
import { useAuth } from '../contexts/use-auth';
import { useToast } from '../contexts/use-toast';
import { api, errorMessage, toQuery } from '../lib/api';
import { formatDate, initials, roleLabel } from '../lib/format';
import type { PageResult, User, UserRole } from '../lib/types';

interface UserForm {
  fullName: string;
  email: string;
  role: UserRole;
  password: string;
}

const blankForm: UserForm = { fullName: '', email: '', role: 'PHARMACIST', password: '' };

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<User> | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api<PageResult<User>>(
          `/users${toQuery({ page, limit: 12, search: search.trim(), role, isActive: active })}`,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [active, page, role, search]);

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

  const openEdit = (item: User) => {
    setEditing(item);
    setForm({ fullName: item.fullName, email: item.email, role: item.role, password: '' });
    setFormError('');
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = editing
      ? { fullName: form.fullName, email: form.email, role: form.role }
      : { ...form, isActive: true };
    try {
      await api(editing ? `/users/${editing.id}` : '/users', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showToast(editing ? 'Đã cập nhật tài khoản.' : 'Đã tạo tài khoản mới.');
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
      await api(`/users/${statusTarget.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !statusTarget.isActive }),
      });
      showToast(statusTarget.isActive ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt tài khoản.');
      setStatusTarget(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordTarget) return;
    setSaving(true);
    setFormError('');
    try {
      await api(`/users/${passwordTarget.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      });
      showToast('Đã đặt lại mật khẩu và thu hồi các phiên cũ.');
      setPasswordTarget(null);
      setNewPassword('');
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
            Quản trị hệ thống
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Người dùng</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý quyền truy cập của quản trị viên và dược sĩ.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Thêm người dùng
        </Button>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row">
          <SearchInput
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Tìm theo họ tên hoặc email…"
            value={search}
          />
          <select
            aria-label="Vai trò"
            className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none"
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            value={role}
          >
            <option value="">Tất cả vai trò</option>
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel[item]}
              </option>
            ))}
          </select>
          <select
            aria-label="Trạng thái"
            className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none"
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
            value={active}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã vô hiệu hóa</option>
          </select>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : loading ? (
          <LoadingState rows={7} />
        ) : !result?.items.length ? (
          <EmptyState
            action={
              <Button onClick={openCreate}>
                <Plus className="size-4" /> Tạo người dùng
              </Button>
            }
            description="Không có người dùng phù hợp với bộ lọc hiện tại."
            title="Chưa có người dùng"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Người dùng</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="w-36 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item) => (
                    <tr className="hover:bg-slate-50" key={item.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid size-9 place-items-center rounded-full text-xs font-bold ${item.role === 'ADMIN' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}
                          >
                            {initials(item.fullName)}
                          </span>
                          <span>
                            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                              {item.fullName}
                              {item.id === currentUser?.id && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                                  Bạn
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-500">{item.email}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.role === 'ADMIN' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}
                        >
                          <ShieldCheck className="size-3.5" />
                          {roleLabel[item.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.isActive ? 'text-emerald-700' : 'text-slate-400'}`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                          {item.isActive ? 'Hoạt động' : 'Vô hiệu hóa'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1">
                          <button
                            aria-label="Chỉnh sửa"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-700"
                            onClick={() => openEdit(item)}
                            type="button"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            aria-label="Đặt lại mật khẩu"
                            className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                            onClick={() => {
                              setPasswordTarget(item);
                              setNewPassword('');
                              setFormError('');
                            }}
                            type="button"
                          >
                            <KeyRound className="size-4" />
                          </button>
                          <button
                            aria-label={item.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                            disabled={item.id === currentUser?.id}
                            onClick={() => setStatusTarget(item)}
                            type="button"
                          >
                            {item.isActive ? (
                              <UserX className="size-4" />
                            ) : (
                              <UserCheck className="size-4" />
                            )}
                          </button>
                        </div>
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
            <Button onClick={() => setFormOpen(false)} variant="secondary">
              Hủy
            </Button>
            <Button form="user-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </>
        }
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title={editing ? 'Cập nhật người dùng' : 'Thêm người dùng'}
      >
        <form className="grid gap-4" id="user-form" onSubmit={submit}>
          <Input
            autoComplete="name"
            label="Họ và tên"
            maxLength={150}
            minLength={2}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            required
            value={form.fullName}
          />
          <Input
            autoComplete="email"
            label="Email"
            maxLength={254}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
            type="email"
            value={form.email}
          />
          <Select
            label="Vai trò"
            onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
            required
            value={form.role}
          >
            {USER_ROLES.map((item) => (
              <option key={item} value={item}>
                {roleLabel[item]}
              </option>
            ))}
          </Select>
          {!editing && (
            <Input
              autoComplete="new-password"
              hint="Tối thiểu 8 ký tự."
              label="Mật khẩu ban đầu"
              maxLength={128}
              minLength={8}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              type="password"
              value={form.password}
            />
          )}
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
            <Button
              loading={saving}
              onClick={() => void changeStatus()}
              variant={statusTarget?.isActive ? 'danger' : 'primary'}
            >
              {statusTarget?.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
            </Button>
          </>
        }
        onClose={() => setStatusTarget(null)}
        open={Boolean(statusTarget)}
        size="sm"
        title={statusTarget?.isActive ? 'Vô hiệu hóa tài khoản' : 'Kích hoạt tài khoản'}
      >
        <p className="text-sm leading-6 text-slate-600">
          {statusTarget?.isActive
            ? `${statusTarget.fullName} sẽ không thể đăng nhập sau khi bị vô hiệu hóa.`
            : `${statusTarget?.fullName} sẽ có thể đăng nhập lại hệ thống.`}
        </p>
      </Modal>
      <Modal
        footer={
          <>
            <Button onClick={() => setPasswordTarget(null)} variant="secondary">
              Hủy
            </Button>
            <Button form="password-form" loading={saving} type="submit">
              Đặt lại mật khẩu
            </Button>
          </>
        }
        onClose={() => setPasswordTarget(null)}
        open={Boolean(passwordTarget)}
        size="sm"
        title="Đặt lại mật khẩu"
      >
        <form className="grid gap-4" id="password-form" onSubmit={resetPassword}>
          <p className="text-sm text-slate-500">
            Mật khẩu mới cho <strong className="text-slate-700">{passwordTarget?.fullName}</strong>.
            Tất cả JWT cũ sẽ bị thu hồi.
          </p>
          <Input
            autoComplete="new-password"
            label="Mật khẩu mới"
            maxLength={128}
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}
