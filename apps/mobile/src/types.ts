import type {
  AllergySeverity,
  AllergyType,
  DiseaseStatus,
  Gender,
  UserRole,
} from '@pharmacy-records/shared';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface PageResult<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Patient {
  id: string;
  patientCode: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  phone: string | null;
  address: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { medicalRecords: number; patientDiseases: number; allergies: number };
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
}

export interface MedicalRecord {
  id: string;
  recordedAt: string;
  title: string | null;
  chiefComplaint: string | null;
  clinicalNotes: string;
  vitalSigns: Record<string, unknown> | null;
  attachments: Attachment[];
  recordedByUser?: Pick<AuthUser, 'id' | 'fullName'>;
}

export interface Allergy {
  id: string;
  type: AllergyType;
  allergenName: string;
  reaction: string | null;
  severity: AllergySeverity;
  recordedAt: string;
  note: string | null;
}

export interface Disease {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface PatientDisease {
  id: string;
  diseaseId: string;
  status: DiseaseStatus;
  diagnosedAt: string | null;
  note: string | null;
  disease?: Pick<Disease, 'id' | 'code' | 'name'>;
}
