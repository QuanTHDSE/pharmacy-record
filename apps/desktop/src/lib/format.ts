import type { AllergySeverity, AllergyType, DiseaseStatus, Gender, UserRole } from './types';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value?: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : 'Chưa cập nhật';
}

export function formatDateTime(value?: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : 'Chưa cập nhật';
}

export function toDateInput(value?: string | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export function toDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function calculateAge(value?: string | null): string {
  if (!value) return '—';
  const birth = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return `${Math.max(age, 0)} tuổi`;
}

export const roleLabel: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  PHARMACIST: 'Dược sĩ',
};

export const genderLabel: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
  UNKNOWN: 'Chưa rõ',
};

export const allergyTypeLabel: Record<AllergyType, string> = {
  MEDICATION: 'Thuốc',
  FOOD: 'Thực phẩm',
  ENVIRONMENT: 'Môi trường',
  OTHER: 'Khác',
};

export const allergySeverityLabel: Record<AllergySeverity, string> = {
  UNKNOWN: 'Chưa rõ',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  SEVERE: 'Nghiêm trọng',
};

export const diseaseStatusLabel: Record<DiseaseStatus, string> = {
  ACTIVE: 'Đang điều trị',
  CHRONIC: 'Mạn tính',
  RESOLVED: 'Đã khỏi',
};

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
