import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly theme = signal<'light' | 'dark'>(this.initialTheme());

  constructor() {
    effect(() => {
      if (!this.isBrowser) return;
      document.documentElement.classList.toggle('dark', this.theme() === 'dark');
      localStorage.setItem('theme', this.theme());
    });
  }

  toggle(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  private initialTheme(): 'light' | 'dark' {
    if (!this.isBrowser) return 'light';
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
