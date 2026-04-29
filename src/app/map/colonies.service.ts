import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { supabaseBrowser } from '../shared/supabase/browser';
import {
  type ColonyFull,
  type ColonyFullRow,
  type ColonyMembership,
  type ColonyMembershipRow,
  type ColonyPublic,
  type ColonyPublicRow,
  parseColonyFullRow,
  parseColonyMembershipRow,
  parseColonyRow,
} from './colony.model';

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
      .select('id, name, description, lat, lng, fuzz_radius_m, cover_photo_path, is_public, member_count, cat_count, eartipped_count, created_at');

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

  async getById(id: string): Promise<ColonyPublic | null> {
    if (!this.isBrowser) return null;
    const sb = supabaseBrowser();
    if (!sb) return null;

    const { data, error } = await sb
      .from('colonies_public')
      .select('id, name, description, lat, lng, fuzz_radius_m, cover_photo_path, is_public, member_count, cat_count, eartipped_count, created_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return parseColonyRow(data as ColonyPublicRow);
  }

  async getFullById(id: string): Promise<ColonyFull | null> {
    if (!this.isBrowser) return null;
    const sb = supabaseBrowser();
    if (!sb) return null;

    const { data, error } = await sb
      .from('colonies_full')
      .select('id, name, description, lat, lng, fuzzed_lat, fuzzed_lng, fuzz_radius_m, owner_id, cover_photo_path, is_public, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return parseColonyFullRow(data as ColonyFullRow);
  }

  async getMembership(colonyId: string): Promise<ColonyMembership | null> {
    if (!this.isBrowser) return null;
    const sb = supabaseBrowser();
    if (!sb) return null;

    const { data, error } = await sb
      .from('colony_memberships')
      .select('colony_id, user_id, role, status, joined_via, created_at')
      .eq('colony_id', colonyId)
      .single();

    if (error || !data) return null;
    return parseColonyMembershipRow(data as ColonyMembershipRow);
  }

  async requestToJoin(colonyId: string): Promise<boolean> {
    const sb = supabaseBrowser();
    if (!sb) return false;

    const { error } = await sb.rpc('request_to_join', { p_colony_id: colonyId });
    return !error;
  }

  async updateColony(
    id: string,
    patch: { name?: string; description?: string | null; isPublic?: boolean },
  ): Promise<boolean> {
    const sb = supabaseBrowser();
    if (!sb) return false;

    const { error } = await sb.rpc('update_colony', {
      p_colony_id: id,
      p_name: patch.name ?? null,
      p_description: patch.description ?? null,
      p_is_public: patch.isPublic ?? null,
    });
    return !error;
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
