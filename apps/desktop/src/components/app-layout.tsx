import {
  Activity,
  ChevronDown,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/use-auth';
import { initials, roleLabel } from '../lib/format';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const primaryNav: NavItem[] = [
  { label: 'Tổng quan', to: '/', icon: LayoutDashboard },
  { label: 'Bệnh nhân', to: '/patients', icon: UsersRound },
  { label: 'Danh mục bệnh lý', to: '/diseases', icon: Stethoscope },
];

const adminNav: NavItem[] = [
  { label: 'Người dùng', to: '/users', icon: UserRound, adminOnly: true },
  { label: 'Nhật ký hệ thống', to: '/audit-logs', icon: FileClock, adminOnly: true },
];

const pageLabels: Record<string, string> = {
  '/': 'Tổng quan',
  '/patients': 'Bệnh nhân',
  '/diseases': 'Danh mục bệnh lý',
  '/users': 'Người dùng',
  '/audit-logs': 'Nhật ký hệ thống',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const label = location.pathname.startsWith('/patients/')
    ? 'Hồ sơ bệnh nhân'
    : (pageLabels[location.pathname] ?? 'Pharmacy Records');

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-800">
      {sidebarOpen && (
        <button
          aria-label="Đóng menu"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-emerald-950/10 bg-[#0e3b32] text-white shadow-xl transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-18 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20">
            <Activity className="size-6" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <p className="font-bold tracking-tight">Pharmacy Records</p>
            <p className="text-[11px] text-emerald-200/75">Quản lý hồ sơ y tế</p>
          </div>
          <button
            aria-label="Đóng menu"
            className="ml-auto rounded-lg p-1.5 text-emerald-100 hover:bg-white/10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/55">
            Vận hành
          </p>
          <div className="grid gap-1">
            {primaryNav.map((item) => (
              <NavigationItem item={item} key={item.to} onNavigate={() => setSidebarOpen(false)} />
            ))}
          </div>
          {isAdmin && (
            <>
              <p className="mb-2 mt-7 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/55">
                Quản trị
              </p>
              <div className="grid gap-1">
                {adminNav.map((item) => (
                  <NavigationItem
                    item={item}
                    key={item.to}
                    onNavigate={() => setSidebarOpen(false)}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.07] p-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-400 text-xs font-bold text-emerald-950">
              {initials(user?.fullName ?? 'ND')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.fullName}</p>
              <p className="truncate text-[11px] text-emerald-100/65">
                {user ? roleLabel[user.role] : ''}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-18 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur md:px-7">
          <button
            aria-label="Mở menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">Không gian làm việc</p>
            <p className="truncate font-semibold text-slate-800">{label}</p>
          </div>
          <button
            className="hidden h-10 w-64 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 sm:flex"
            onClick={() => navigate('/patients')}
            type="button"
          >
            <Search className="size-4" />
            Tìm bệnh nhân…
            <kbd className="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">
              Ctrl K
            </kbd>
          </button>
          <div className="relative">
            <button
              className="ml-1 flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
              onClick={() => setProfileOpen((value) => !value)}
              type="button"
            >
              <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                {initials(user?.fullName ?? 'ND')}
              </span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-12 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-slate-800">{user?.fullName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
                  onClick={signOut}
                  type="button"
                >
                  <LogOut className="size-4" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 md:p-7 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavigationItem({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-emerald-400 text-emerald-950 shadow-sm'
            : 'text-emerald-50/80 hover:bg-white/[0.08] hover:text-white'
        }`
      }
      end={item.to === '/'}
      onClick={onNavigate}
      to={item.to}
    >
      <Icon className="size-[18px]" />
      {item.label}
    </NavLink>
  );
}
