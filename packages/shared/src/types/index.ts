import type {
  ALLERGY_SEVERITIES,
  ALLERGY_TYPES,
  DISEASE_STATUSES,
  GENDERS,
  USER_ROLES,
} from '../constants';

export type UserRole = (typeof USER_ROLES)[number];

export type Gender = (typeof GENDERS)[number];

export type DiseaseStatus = (typeof DISEASE_STATUSES)[number];

export type AllergyType = (typeof ALLERGY_TYPES)[number];

export type AllergySeverity = (typeof ALLERGY_SEVERITIES)[number];
