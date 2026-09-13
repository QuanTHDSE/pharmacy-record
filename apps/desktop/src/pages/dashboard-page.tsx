import {
  Activity,
  ArrowRight,
  Clock3,
  FileHeart,
  ShieldCheck,
  Stethoscope,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui';
import { useAuth } from '../contexts/use-auth';
import { api, errorMessage, toQuery } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AuditLog, Disease, PageResult, Patient, User } from '../lib/types';

interface DashboardData {
  patients: PageResult<Patient>;
  diseases: PageResult<Disease>;
  users?: PageResult<User>;
  audits?: PageResult<AuditLog>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [patients, diseases, users, audits] = await Promise.all([
        api<PageResult<Patient>>(`/patients${toQuery({ page: 1, limit: 5 })}`),
        api<PageResult<Disease>>(`/diseases${toQuery({ page: 1, limit: 1, isActive: true })}`),
        isAdmin ? api<PageResult<User>>(`/users${toQuery({ page: 1, limit: 1 })}`) : undefined,
        isAdmin
          ? api<PageResult<AuditLog>>(`/audit-logs${toQuery({ page: 1, limit: 5 })}`)
          : undefined,
      ]);
      setData({ patients, diseases, users, audits });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const greeting =
    new Date().getHours() < 12
      ? 'Chào buổi sáng'
      : new Date().getHours() < 18
        ? 'Chào buổi chiều'
        : 'Chào buổi tối';

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-7">
      <section className="relative overflow-hidden rounded-2xl bg-[#164b3f] px-6 py-7 text-white shadow-sm md:px-8">
        <div className="absolute -right-16 -top-24 size-72 rounded-full border-[54px] border-emerald-300/[0.08]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm text-emerald-100/70">{greeting},</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{user?.fullName}</h1>
            <p className="mt-2 text-sm text-emerald-50/65">
              Tổng quan hoạt động tại nhà thuốc hôm nay.
            </p>
          </div>
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-200"
            to="/patients"
          >
            <UserRoundPlus className="size-4" /> Tiếp nhận bệnh nhân
          </Link>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading || !data ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <LoadingState rows={4} />
        </div>
      ) : (
        <>
          <section
            className={`mt-5 grid gap-4 sm:grid-cols-2 ${isAdmin ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}
          >
            <StatCard
              icon={UsersRound}
              label="Bệnh nhân đang quản lý"
              tone="emerald"
              value={data.patients.pagination.total}
            />
            <StatCard
              icon={Stethoscope}
              label="Bệnh lý đang sử dụng"
              tone="blue"
              value={data.diseases.pagination.total}
            />
            {isAdmin && (
              <StatCard
                icon={ShieldCheck}
                label="Tài khoản hệ thống"
                tone="violet"
                value={data.users?.pagination.total ?? 0}
              />
            )}
            <StatCard
              icon={FileHeart}
              label="Hồ sơ gần đây"
              tone="amber"
              value={data.patients.items.length}
              suffix="bệnh nhân"
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="font-bold text-slate-900">Bệnh nhân mới cập nhật</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Danh sách hoạt động gần nhất</p>
                </div>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  to="/patients"
                >
                  Xem tất cả <ArrowRight className="size-4" />
                </Link>
              </header>
              {data.patients.items.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  Chưa có bệnh nhân trong hệ thống.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.patients.items.map((patient) => (
                    <Link
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-emerald-50/50"
                      key={patient.id}
                      to={`/patients/${patient.id}`}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-800">
                        {patient.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">
                          {patient.fullName}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {patient.patientCode} · {patient.phone ?? 'Chưa có SĐT'}
                        </span>
                      </span>
                      <span className="hidden text-xs text-slate-400 sm:block">
                        {formatDateTime(patient.updatedAt)}
                      </span>
                      <ArrowRight className="size-4 text-slate-300" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold text-slate-900">Hoạt động gần đây</h2>
                <p className="mt-0.5 text-xs text-slate-500">Dấu vết vận hành hệ thống</p>
              </header>
              {!isAdmin ? (
                <div className="grid min-h-64 place-items-center px-6 text-center">
                  <div>
                    <div className="mx-auto grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Activity className="size-5" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Hệ thống đang hoạt động
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Nhật ký chi tiết chỉ hiển thị cho quản trị viên.
                    </p>
                  </div>
                </div>
              ) : data.audits?.items.length ? (
                <div className="divide-y divide-slate-100">
                  {data.audits.items.map((log) => (
                    <div className="flex gap-3 px-5 py-3.5" key={log.id}>
                      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                        <Clock3 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-700">
                          {log.action.replaceAll('_', ' ')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {log.actorUser?.fullName ?? 'Hệ thống'} · {formatDateTime(log.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-64 place-items-center text-sm text-slate-500">
                  Chưa có hoạt động.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  tone: 'emerald' | 'blue' | 'violet' | 'amber';
}) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value.toLocaleString('vi-VN')}
          </p>
          {suffix && <p className="mt-0.5 text-xs text-slate-400">{suffix}</p>}
        </div>
        <div className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </article>
  );
}
