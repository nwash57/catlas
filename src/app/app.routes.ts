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
    path: 'map',
    loadComponent: () => import('./map/map').then((m) => m.MapPage),
    title: 'Colony Map — Catlas',
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [authGuard],
    title: 'Dashboard — Catlas',
  },
  {
    path: 'colonies/:id',
    loadComponent: () => import('./colonies/colony-profile').then((m) => m.ColonyProfile),
    title: 'Colony — Catlas',
  },
  {
    path: 'learn',
    loadComponent: () => import('./learn/learn-shell').then((m) => m.LearnShell),
    children: [
      {
        path: 'what-is-tnr',
        loadComponent: () => import('./learn/what-is-tnr').then((m) => m.WhatIsTnr),
        title: 'What is TNR? — Catlas',
      },
      {
        path: 'why-tnr-works',
        loadComponent: () => import('./learn/why-tnr-works').then((m) => m.WhyTnrWorks),
        title: 'Why TNR works — Catlas',
      },
      {
        path: 'how-to-start',
        loadComponent: () => import('./learn/how-to-start').then((m) => m.HowToStart),
        title: 'How to start a TNR program — Catlas',
      },
      {
        path: 'how-to-help',
        loadComponent: () => import('./learn/how-to-help').then((m) => m.HowToHelp),
        title: 'How to help without trapping — Catlas',
      },
    ],
  },
];
