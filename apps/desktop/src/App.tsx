import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { useAuth } from './contexts/use-auth';
import { AuditLogsPage } from './pages/audit-logs-page';
import { DashboardPage } from './pages/dashboard-page';
import { DiseasesPage } from './pages/diseases-page';
import { LoginPage } from './pages/login-page';
import { NotFoundPage } from './pages/not-found-page';
import { PatientDetailPage } from './pages/patient-detail-page';
import { PatientsPage } from './pages/patients-page';
import { UsersPage } from './pages/users-page';

export function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<DashboardPage />} index />
          <Route element={<PatientsPage />} path="patients" />
          <Route element={<PatientDetailPage />} path="patients/:id" />
          <Route element={<DiseasesPage />} path="diseases" />
          <Route element={<AdminRoute />}>
            <Route element={<UsersPage />} path="users" />
            <Route element={<AuditLogsPage />} path="audit-logs" />
          </Route>
          <Route element={<NotFoundPage />} path="*" />
        </Route>
      </Route>
    </Routes>
  );
}

function ProtectedRoute() {
  const { user, isBooting } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate('/patients');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [navigate]);

  if (isBooting) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f7f6] text-emerald-700">
        <div className="text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin" />
          <p className="mt-3 text-sm font-medium">Đang khôi phục phiên làm việc…</p>
        </div>
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate replace state={{ from: location.pathname }} to="/login" />;
}

function AdminRoute({ children }: PropsWithChildren) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') return <Navigate replace to="/" />;
  return children ?? <Outlet />;
}
