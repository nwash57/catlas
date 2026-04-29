export type CatAge = 'unknown' | 'kitten' | 'juvenile' | 'adult' | 'senior';
export type CatSex = 'unknown' | 'male' | 'female';
export type CatTemperament = 'unknown' | 'feral' | 'socializable' | 'friendly';
export type CatSterilization = 'unknown' | 'intact' | 'sterilized';

export interface CatPublicRow {
  id: string;
  colony_id: string;
  name: string | null;
  description: string | null;
  photo_path: string | null;
  coat: string | null;
  approx_age: CatAge;
  ear_tipped: boolean;
  deceased_at: string | null;
  created_at: string;
}

export interface CatPublic {
  id: string;
  colonyId: string;
  name: string | null;
  description: string | null;
  photoPath: string | null;
  coat: string | null;
  approxAge: CatAge;
  earTipped: boolean;
  deceasedAt: string | null;
  createdAt: string;
}

export function parseCatPublicRow(row: CatPublicRow): CatPublic {
  return {
    id: row.id,
    colonyId: row.colony_id,
    name: row.name,
    description: row.description,
    photoPath: row.photo_path,
    coat: row.coat,
    approxAge: row.approx_age,
    earTipped: row.ear_tipped,
    deceasedAt: row.deceased_at,
    createdAt: row.created_at,
  };
}

export interface CatFullRow extends CatPublicRow {
  sex: CatSex;
  temperament: CatTemperament;
  sterilization: CatSterilization;
  scheduled_for: string | null;
  notes: string | null;
  health_concerns: string | null;
  created_by: string;
  updated_at: string;
}

export interface CatFull extends CatPublic {
  sex: CatSex;
  temperament: CatTemperament;
  sterilization: CatSterilization;
  scheduledFor: string | null;
  notes: string | null;
  healthConcerns: string | null;
  createdBy: string;
  updatedAt: string;
}

export function parseCatFullRow(row: CatFullRow): CatFull {
  return {
    ...parseCatPublicRow(row),
    sex: row.sex,
    temperament: row.temperament,
    sterilization: row.sterilization,
    scheduledFor: row.scheduled_for,
    notes: row.notes,
    healthConcerns: row.health_concerns,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export interface CatWritePatch {
  name?: string | null;
  description?: string | null;
  coat?: string | null;
  approxAge?: CatAge;
  sex?: CatSex;
  temperament?: CatTemperament;
  sterilization?: CatSterilization;
  earTipped?: boolean;
  scheduledFor?: string | null;
  notes?: string | null;
  healthConcerns?: string | null;
  deceasedAt?: string | null;
}

export function patchToRow(patch: CatWritePatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row['name'] = patch.name;
  if (patch.description !== undefined) row['description'] = patch.description;
  if (patch.coat !== undefined) row['coat'] = patch.coat;
  if (patch.approxAge !== undefined) row['approx_age'] = patch.approxAge;
  if (patch.sex !== undefined) row['sex'] = patch.sex;
  if (patch.temperament !== undefined) row['temperament'] = patch.temperament;
  if (patch.sterilization !== undefined) row['sterilization'] = patch.sterilization;
  if (patch.earTipped !== undefined) row['ear_tipped'] = patch.earTipped;
  if (patch.scheduledFor !== undefined) row['scheduled_for'] = patch.scheduledFor;
  if (patch.notes !== undefined) row['notes'] = patch.notes;
  if (patch.healthConcerns !== undefined) row['health_concerns'] = patch.healthConcerns;
  if (patch.deceasedAt !== undefined) row['deceased_at'] = patch.deceasedAt;
  return row;
}
