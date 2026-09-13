import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  FileHeart,
  MapPin,
  Phone,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { calculateAge, formatDate, genderLabel } from '../lib/format';
import type { Patient } from '../lib/types';
import { PatientAllergiesTab } from './patient/patient-allergies-tab';
import { PatientDiseasesTab } from './patient/patient-diseases-tab';
import { PatientRecordsTab } from './patient/patient-records-tab';

type PatientTab = 'overview' | 'records' | 'allergies' | 'diseases';

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<PatientTab>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setPatient(await api<Patient>(`/patients/${id}`));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading)
    return (
      <div className="mx-auto max-w-[1500px] p-4 md:p-7">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <LoadingState rows={8} />
        </div>
      </div>
    );
  if (error || !patient || !id)
    return (
      <div className="mx-auto max-w-[1500px] p-4 md:p-7">
        <ErrorState message={error || 'Không tìm thấy bệnh nhân.'} onRetry={() => void load()} />
      </div>
    );

  const tabs: Array<{ id: PatientTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'records', label: 'Hồ sơ y tế', count: patient._count?.medicalRecords },
    { id: 'allergies', label: 'Dị ứng', count: patient._count?.allergies },
    { id: 'diseases', label: 'Bệnh lý', count: patient._count?.patientDiseases },
  ];

  return (
    <div className="mx-auto max-w-[1500px] p-4 md:p-7">
      <Link
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-emerald-700"
        to="/patients"
      >
        <ArrowLeft className="size-4" /> Danh sách bệnh nhân
      </Link>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative bg-gradient-to-r from-[#12463a] to-[#1a6551] px-6 py-7 text-white md:px-8">
          <div className="absolute right-10 top-0 size-40 rounded-full bg-emerald-300/5 blur-2xl" />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="grid size-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-2xl font-bold backdrop-blur">
              {patient.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{patient.fullName}</h1>
                <span className="rounded-full bg-emerald-300 px-2.5 py-1 font-mono text-xs font-bold text-emerald-950">
                  {patient.patientCode}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-emerald-50/70">
                <span>{patient.gender ? genderLabel[patient.gender] : 'Chưa rõ giới tính'}</span>
                <span>{calculateAge(patient.dateOfBirth)}</span>
                <span>Tiếp nhận {formatDate(patient.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-2 md:px-6">
          {tabs.map((item) => (
            <button
              className={`relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition ${tab === item.id ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
              {item.count !== undefined && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${tab === item.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {item.count}
                </span>
              )}
              {tab === item.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-600" />
              )}
            </button>
          ))}
        </nav>
      </section>

      <div className="mt-5">
        {tab === 'overview' && <Overview patient={patient} onNavigate={setTab} />}
        {tab === 'records' && <PatientRecordsTab patientId={id} />}
        {tab === 'allergies' && <PatientAllergiesTab patientId={id} />}
        {tab === 'diseases' && <PatientDiseasesTab patientId={id} />}
      </div>
    </div>
  );
}

function Overview({
  patient,
  onNavigate,
}: {
  patient: Patient;
  onNavigate: (tab: PatientTab) => void;
}) {
  const contactRows = [
    { icon: Phone, label: 'Số điện thoại', value: patient.phone ?? 'Chưa cập nhật' },
    { icon: CalendarDays, label: 'Ngày sinh', value: formatDate(patient.dateOfBirth) },
    {
      icon: UserRound,
      label: 'Giới tính',
      value: patient.gender ? genderLabel[patient.gender] : 'Chưa cập nhật',
    },
    { icon: MapPin, label: 'Địa chỉ', value: patient.address ?? 'Chưa cập nhật' },
  ];
  const quickCards = [
    {
      tab: 'records' as const,
      icon: FileHeart,
      label: 'Hồ sơ y tế',
      count: patient._count?.medicalRecords ?? 0,
      tone: 'bg-blue-100 text-blue-700',
    },
    {
      tab: 'allergies' as const,
      icon: AlertTriangle,
      label: 'Thông tin dị ứng',
      count: patient._count?.allergies ?? 0,
      tone: 'bg-rose-100 text-rose-700',
    },
    {
      tab: 'diseases' as const,
      icon: Stethoscope,
      label: 'Bệnh lý',
      count: patient._count?.patientDiseases ?? 0,
      tone: 'bg-amber-100 text-amber-700',
    },
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-900">Thông tin cá nhân</h2>
        <div className="mt-4 grid gap-4">
          {contactRows.map(({ icon: Icon, label, value }) => (
            <div className="flex gap-3" key={label}>
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <Icon className="size-4" />
              </div>
              <div>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-5">
        <section className="grid gap-4 sm:grid-cols-2">
          {quickCards.map(({ tab, icon: Icon, label, count, tone }) => (
            <button
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              key={label}
              onClick={() => onNavigate(tab)}
              type="button"
            >
              <span className={`grid size-11 place-items-center rounded-xl ${tone}`}>
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block text-2xl font-bold text-slate-900">{count}</span>
                <span className="text-sm text-slate-500">{label}</span>
              </span>
            </button>
          ))}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Ghi chú chung</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {patient.note || 'Chưa có ghi chú cho bệnh nhân này.'}
          </p>
        </section>
      </div>
    </div>
  );
}
