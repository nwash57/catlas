import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { Landing } from './landing/landing';

export const routes: Routes = [
  {
    path: '',
    component: Landing,
    title: 'Catlas — Bringing the community to community cats',
  },
  {
    path: 'auth/sign-in',
    loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn),
    title: 'Sign in — Catlas',
  },
  {
    path: 'auth/sign-up',
    loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp),
    title: 'Create your account — Catlas',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: 'Dashboard — Catlas',
  },
];
