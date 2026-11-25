import express from 'express';
import path from 'node:path';
import type { KaiDatabase } from './db';
export function createApp(db: KaiDatabase) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req,res) => res.json({status:'ok',commit:process.env.KAI_COMMIT ?? 'local'}));
  app.get('/api/people', (_req,res) => res.json(db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id = ? ORDER BY name COLLATE NOCASE').all('public')));
  app.use('/api', (_req,res) => res.status(404).json({error:'Not found'}));
  app.use(express.static(path.resolve('dist')));
  app.get(['/', '/home', '/people', '/todos', '/connect'], (_req,res) => res.sendFile('index.html', {root:path.resolve('dist')}));
  return app;
}
