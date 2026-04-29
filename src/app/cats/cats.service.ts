import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { supabaseBrowser } from '../shared/supabase/browser';
import {
  type CatFull,
  type CatFullRow,
  type CatPublic,
  type CatPublicRow,
  type CatWritePatch,
  parseCatFullRow,
  parseCatPublicRow,
  patchToRow,
} from './cat.model';

const PUBLIC_COLUMNS =
  'id, colony_id, name, description, photo_path, coat, approx_age, ear_tipped, deceased_at, created_at';

const FULL_COLUMNS =
  PUBLIC_COLUMNS +
  ', sex, temperament, sterilization, scheduled_for, notes, health_concerns, created_by, updated_at';

@Injectable({ providedIn: 'root' })
export class CatsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  async listPublicByColony(colonyId: string): Promise<CatPublic[]> {
    if (!this.isBrowser) return [];
    const sb = supabaseBrowser();
    if (!sb) return [];

    const { data, error } = await sb
      .from('cats_public')
      .select(PUBLIC_COLUMNS)
      .eq('colony_id', colonyId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return (data as unknown as CatPublicRow[]).map(parseCatPublicRow);
  }

  async listFullByColony(colonyId: string): Promise<CatFull[]> {
    if (!this.isBrowser) return [];
    const sb = supabaseBrowser();
    if (!sb) return [];

    const { data, error } = await sb
      .from('cats_full')
      .select(FULL_COLUMNS)
      .eq('colony_id', colonyId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return (data as unknown as CatFullRow[]).map(parseCatFullRow);
  }

  async create(colonyId: string, patch: CatWritePatch): Promise<string | null> {
    const sb = supabaseBrowser();
    if (!sb) return null;

    const { data: userData } = await sb.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;

    const { data, error } = await sb
      .from('cats')
      .insert({ colony_id: colonyId, created_by: userId, ...patchToRow(patch) })
      .select('id')
      .single();

    if (error || !data) return null;
    return (data as { id: string }).id;
  }

  async update(catId: string, patch: CatWritePatch): Promise<boolean> {
    const sb = supabaseBrowser();
    if (!sb) return false;

    const row = patchToRow(patch);
    if (Object.keys(row).length === 0) return true;

    const { error } = await sb.from('cats').update(row).eq('id', catId);
    return !error;
  }

  async delete(catId: string): Promise<boolean> {
    const sb = supabaseBrowser();
    if (!sb) return false;

    const { error } = await sb.from('cats').delete().eq('id', catId);
    return !error;
  }
}
