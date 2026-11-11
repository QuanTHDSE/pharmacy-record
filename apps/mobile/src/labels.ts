import type {
  AllergySeverity,
  AllergyType,
  DiseaseStatus,
  Gender,
  UserRole,
} from '@pharmacy-records/shared';
import type { Patient } from './types';
import type { Tone } from './ui';
import { ageFrom } from './ui';

export const genderLabels: Record<Gender, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
  UNKNOWN: 'Chưa rõ',
};

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  PHARMACIST: 'Dược sĩ',
};

export const allergyTypeLabels: Record<AllergyType, string> = {
  MEDICATION: 'Thuốc',
  FOOD: 'Thực phẩm',
  ENVIRONMENT: 'Môi trường',
  OTHER: 'Khác',
};

export const severityLabels: Record<AllergySeverity, string> = {
  UNKNOWN: 'Chưa rõ mức độ',
  MILD: 'Nhẹ',
  MODERATE: 'Vừa',
  SEVERE: 'Nặng',
};

export const severityTones: Record<AllergySeverity, Tone> = {
  UNKNOWN: 'neutral',
  MILD: 'info',
  MODERATE: 'warning',
  SEVERE: 'danger',
};

export const severityRank: Record<AllergySeverity, number> = {
  SEVERE: 3,
  MODERATE: 2,
  MILD: 1,
  UNKNOWN: 0,
};

export const diseaseStatusLabels: Record<DiseaseStatus, string> = {
  ACTIVE: 'Đang điều trị',
  CHRONIC: 'Mạn tính',
  RESOLVED: 'Đã khỏi',
};

export const diseaseStatusTones: Record<DiseaseStatus, Tone> = {
  ACTIVE: 'info',
  CHRONIC: 'warning',
  RESOLVED: 'success',
};

/** "Nam · 35 tuổi" – bỏ phần nào chưa có dữ liệu. */
export function patientDemographics(patient: Pick<Patient, 'gender' | 'dateOfBirth'>): string {
  const age = ageFrom(patient.dateOfBirth);
  return [
    patient.gender && patient.gender !== 'UNKNOWN' ? genderLabels[patient.gender] : null,
    age !== null ? `${age} tuổi` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
