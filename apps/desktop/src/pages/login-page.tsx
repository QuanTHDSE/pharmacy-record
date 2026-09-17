import { Activity, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/use-auth';
import { errorMessage } from '../lib/api';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate replace to="/" />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#f3f7f5] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#0d3b31] p-14 text-white lg:flex lg:flex-col">
        <div className="absolute -right-28 -top-24 size-96 rounded-full border-[70px] border-emerald-400/10" />
        <div className="absolute -bottom-48 -left-40 size-[34rem] rounded-full border-[100px] border-white/[0.04]" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-400 text-emerald-950">
            <Activity className="size-7" strokeWidth={2.4} />
          </div>
          <div>
            <p className="font-bold">Pharmacy Records</p>
            <p className="text-xs text-emerald-100/65">Hồ sơ sức khỏe, luôn trong tầm tay</p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl pb-10">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
            Chăm sóc liền mạch
          </p>
          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight xl:text-6xl">
            Hiểu rõ người bệnh.
            <span className="mt-2 block text-emerald-300">Phục vụ tốt hơn.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-emerald-50/70">
            Quản lý thông tin bệnh nhân, tiền sử dị ứng và hồ sơ y tế trong một không gian làm việc
            an toàn, rõ ràng.
          </p>
        </div>
        <p className="relative text-xs text-emerald-100/45">
          Dữ liệu nội bộ · Truy cập có kiểm soát
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-white">
              <Activity className="size-6" />
            </div>
            <p className="font-bold text-slate-800">Pharmacy Records</p>
          </div>
          <p className="text-sm font-semibold text-emerald-700">Chào mừng trở lại</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Đăng nhập hệ thống
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sử dụng tài khoản nội bộ do quản trị viên cung cấp.
          </p>

          <form className="mt-8 grid gap-5" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Email
              <span className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  autoComplete="username"
                  autoFocus
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ten@nhathuoc.local"
                  required
                  type="email"
                  value={email}
                />
              </span>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mật khẩu
              <span className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
                <input
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-11 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            {error && (
              <div
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting && <LoaderCircle className="size-4 animate-spin" />}
              {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Phiên đăng nhập sẽ kết thúc khi đóng ứng dụng để bảo vệ dữ liệu bệnh nhân.
          </p>
        </div>
      </section>
    </main>
  );
}
