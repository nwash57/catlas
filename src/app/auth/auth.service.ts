import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AuthError, User } from '@supabase/supabase-js';

import { supabaseBrowser } from '../shared/supabase/browser';

export type AuthResult = { error: AuthError | { message: string } | null };

const NOT_CONFIGURED: AuthResult = {
  error: { message: 'Authentication is not configured. Add Supabase credentials to src/environments/environment*.ts.' },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(this.isBrowser);

  private resolveReady!: () => void;
  readonly ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

  constructor() {
    if (!this.isBrowser) {
      this.resolveReady();
      return;
    }
    const sb = supabaseBrowser();
    if (!sb) {
      console.warn(
        '[Catlas] Supabase is not configured — auth is disabled. See src/environments/environment*.ts.',
      );
      this.isLoading.set(false);
      this.resolveReady();
      return;
    }
    sb.auth.getUser().then(({ data }) => {
      this.currentUser.set(data.user ?? null);
      this.isLoading.set(false);
      this.resolveReady();
    });
    sb.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  async signUp(email: string, password: string): Promise<AuthResult> {
    const sb = supabaseBrowser();
    if (!sb) return NOT_CONFIGURED;
    const { error } = await sb.auth.signUp({ email, password });
    return { error };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const sb = supabaseBrowser();
    if (!sb) return NOT_CONFIGURED;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return { error };
  }

  async signOut(): Promise<AuthResult> {
    const sb = supabaseBrowser();
    if (!sb) return NOT_CONFIGURED;
    const { error } = await sb.auth.signOut();
    return { error };
  }
}
