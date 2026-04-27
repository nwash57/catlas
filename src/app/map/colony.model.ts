export interface ColonyPublicRow {
  id: string;
  name: string;
  description: string | null;
  fuzzed_location: string | { type: string; coordinates: [number, number] };
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

export function parseColonyRow(row: ColonyPublicRow): ColonyPublic | null {
  let lng: number;
  let lat: number;

  try {
    const geo =
      typeof row.fuzzed_location === 'string'
        ? JSON.parse(row.fuzzed_location)
        : row.fuzzed_location;

    if (geo?.type !== 'Point' || !Array.isArray(geo.coordinates)) return null;
    [lng, lat] = geo.coordinates as [number, number];
  } catch {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fuzzRadiusM: row.fuzz_radius_m,
    coverPhotoPath: row.cover_photo_path,
    lng,
    lat,
  };
}
