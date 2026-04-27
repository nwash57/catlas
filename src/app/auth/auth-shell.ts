import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ThemeToggle } from '../shared/theme-toggle.component';

@Component({
  selector: 'app-auth-shell',
  imports: [RouterLink, ThemeToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-50">
      <header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a routerLink="/" class="font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Catlas
        </a>
        <app-theme-toggle />
      </header>
      <main class="mx-auto flex max-w-md flex-col px-6 pt-8 pb-24">
        <p class="mb-3 font-mono text-xs tracking-[0.2em] text-amber-700 uppercase dark:text-amber-500">
          {{ eyebrow() }}
        </p>
        <h1 class="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ heading() }}
        </h1>
        <p class="mt-3 text-stone-600 dark:text-stone-400">
          <ng-content select="[slot=subhead]"></ng-content>
        </p>
        <div class="mt-8">
          <ng-content></ng-content>
        </div>
      </main>
    </div>
  `,
})
export class AuthShell {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
}
