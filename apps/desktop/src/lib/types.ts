import type {
  AllergySeverity,
  AllergyType,
  DiseaseStatus,
  Gender,
  UserRole,
} from '@pharmacy-records/shared';

export type { AllergySeverity, AllergyType, DiseaseStatus, Gender, UserRole };

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { timestamp: string; requestId: string };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUser;
}

export interface User extends AuthUser {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  deletedAt: string | null;
  _count?: {
    medicalRecords: number;
    patientDiseases: number;
    allergies: number;
  };
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  recordedByUserId: string;
  recordedAt: string;
  title: string | null;
  chiefComplaint: string | null;
  clinicalNotes: string;
  vitalSigns: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  recordedByUser?: Pick<AuthUser, 'id' | 'fullName'>;
  attachments: MedicalRecordAttachment[];
}

export interface MedicalRecordAttachment {
  id: string;
  medicalRecordId: string;
  uploadedByUserId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  uploadedByUser?: Pick<AuthUser, 'id' | 'fullName'>;
}

export interface Allergy {
  id: string;
  patientId: string;
  medicalRecordId: string | null;
  recordedByUserId: string;
  type: AllergyType;
  allergenName: string;
  reaction: string | null;
  severity: AllergySeverity;
  recordedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  recordedByUser?: Pick<AuthUser, 'id' | 'fullName'>;
}

export interface Disease {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientDisease {
  id: string;
  patientId: string;
  diseaseId: string;
  medicalRecordId: string | null;
  recordedByUserId: string;
  status: DiseaseStatus;
  diagnosedAt: string | null;
  resolvedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  disease?: Pick<Disease, 'id' | 'code' | 'name'>;
  recordedByUser?: Pick<AuthUser, 'id' | 'fullName'>;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  occurredAt: string;
  actorUser: AuthUser | null;
}

export type QueryValue = string | number | boolean | null | undefined;
