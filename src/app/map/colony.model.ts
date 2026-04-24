export interface ColonyPublicRow {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  fuzz_radius_m: number;
  cover_photo_path: string | null;
  is_public: boolean;
  member_count: number;
  created_at: string;
}

export interface ColonyPublic {
  id: string;
  name: string;
  description: string | null;
  fuzzRadiusM: number;
  coverPhotoPath: string | null;
  isPublic: boolean;
  memberCount: number;
  lng: number;
  lat: number;
}

export function parseColonyRow(row: ColonyPublicRow): ColonyPublic {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fuzzRadiusM: row.fuzz_radius_m,
    coverPhotoPath: row.cover_photo_path,
    isPublic: row.is_public,
    memberCount: row.member_count,
    lng: row.lng,
    lat: row.lat,
  };
}

export interface ColonyFullRow {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  fuzzed_lat: number;
  fuzzed_lng: number;
  fuzz_radius_m: number;
  owner_id: string;
  cover_photo_path: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ColonyFull {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  fuzzedLat: number;
  fuzzedLng: number;
  fuzzRadiusM: number;
  ownerId: string;
  coverPhotoPath: string | null;
  isPublic: boolean;
}

export function parseColonyFullRow(row: ColonyFullRow): ColonyFull {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    fuzzedLat: row.fuzzed_lat,
    fuzzedLng: row.fuzzed_lng,
    fuzzRadiusM: row.fuzz_radius_m,
    ownerId: row.owner_id,
    coverPhotoPath: row.cover_photo_path,
    isPublic: row.is_public,
  };
}

export interface ColonyMembershipRow {
  colony_id: string;
  user_id: string;
  role: 'owner' | 'caretaker' | 'member';
  status: 'pending' | 'active';
  joined_via: 'request' | 'qr' | 'created';
  created_at: string;
}

export interface ColonyMembership {
  colonyId: string;
  userId: string;
  role: 'owner' | 'caretaker' | 'member';
  status: 'pending' | 'active';
  joinedVia: 'request' | 'qr' | 'created';
  createdAt: string;
}

export function parseColonyMembershipRow(row: ColonyMembershipRow): ColonyMembership {
  return {
    colonyId: row.colony_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedVia: row.joined_via,
    createdAt: row.created_at,
  };
}
