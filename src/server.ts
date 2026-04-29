import 'dotenv/config';

import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { registerCatPhotoRoutes } from './server/cat-photo-routes';
import { supabaseServer } from './app/shared/supabase/server';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Per-request Supabase server client on res.locals. SSR API routes
 * (invite signing, EXIF-stripped uploads, admin seeds) read it from here.
 * Initial-render auth handoff into Angular DI is a separate follow-up —
 * for now, the Angular app reads auth state via the browser client on hydration.
 */
app.use((req, res, next) => {
  if (process.env['SUPABASE_URL'] && process.env['SUPABASE_ANON_KEY']) {
    res.locals['supabase'] = supabaseServer(req, res);
  }
  next();
});

registerCatPhotoRoutes(app);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
