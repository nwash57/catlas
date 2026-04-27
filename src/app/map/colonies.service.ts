import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { supabaseBrowser } from '../shared/supabase/browser';
import { type ColonyPublic, type ColonyPublicRow, parseColonyRow } from './colony.model';

@Injectable({ providedIn: 'root' })
export class ColoniesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly colonies = signal<ColonyPublic[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    if (!this.isBrowser) return;

    const sb = supabaseBrowser();
    if (!sb) {
      this.error.set('Supabase not configured');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await sb
      .from('colonies_public')
      .select('id, name, description, lat, lng, fuzz_radius_m, cover_photo_path, created_at');

    this.loading.set(false);

    if (error) {
      this.error.set(error.message);
      return;
    }

    const parsed = (data as ColonyPublicRow[])
      .map(parseColonyRow)
      .filter((c): c is ColonyPublic => c !== null);

    this.colonies.set(parsed);
  }

  async create(
    name: string,
    description: string | null,
    lat: number,
    lng: number,
    fuzzRadiusM: number,
  ): Promise<string | null> {
    const sb = supabaseBrowser();
    if (!sb) { this.error.set('Supabase not configured'); return null; }

    const { data, error } = await sb.rpc('create_colony', {
      p_name: name,
      p_description: description,
      p_lat: lat,
      p_lng: lng,
      p_fuzz_radius_m: fuzzRadiusM,
    });

    if (error) { this.error.set(error.message); return null; }
    return data as string;
  }
}
