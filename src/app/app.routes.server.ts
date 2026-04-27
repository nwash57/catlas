import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'map', renderMode: RenderMode.Client },
  { path: 'dashboard', renderMode: RenderMode.Server },
  { path: 'auth/sign-in', renderMode: RenderMode.Server },
  { path: 'auth/sign-up', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
