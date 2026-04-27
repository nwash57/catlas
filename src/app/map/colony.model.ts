export interface ColonyPublicRow {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  fuzz_radius_m: number;
  cover_photo_path: string | null;
  created_at: string;
}

export interface ColonyPublic {
  id: string;
  name: string;
  description: string | null;
  fuzzRadiusM: number;
  coverPhotoPath: string | null;
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
    lng: row.lng,
    lat: row.lat,
  };
}
