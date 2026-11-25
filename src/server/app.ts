import express from 'express';
import path from 'node:path';
import type { KaiDatabase } from './db';
import { cookieName, createJudge, equalSecret, workspaceFor } from './access';
export type AppOptions = {judgeSecret?:string; videoUrl?:string; secureCookies?:boolean};
export function createApp(db: KaiDatabase, options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req,res,next) => {res.set({'Referrer-Policy':'no-referrer','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();});
  app.use(express.json({limit:'32kb'}));
  app.use((req,res,next) => {
    res.locals.workspace = workspaceFor(db,req);
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== `${options.secureCookies === false ? req.protocol : 'https'}://${req.get('host')}`) {res.status(403).json({error:'This request is not allowed.'});return;}
      if (!(req.path === '/api/access/start' && req.method === 'POST') && res.locals.workspace === 'public') {res.status(403).json({error:'This demo is read-only.'});return;}
    }
    next();
  });
  app.post('/api/access/start',(req,res) => {
    if (!options.judgeSecret || typeof req.body?.secret !== 'string' || !equalSecret(req.body.secret,options.judgeSecret)) {res.status(403).json({error:'This link could not be opened.'});return;}
    if (res.locals.workspace === 'public') {
      const judge = createJudge(db);
      res.cookie(cookieName,judge.cookie,{httpOnly:true,secure:options.secureCookies ?? true,sameSite:'strict',path:'/',maxAge:14*24*60*60*1000});
    }
    res.json({ok:true});
  });
  app.get('/healthz', (_req,res) => res.json({status:'ok',commit:process.env.KAI_COMMIT ?? 'local'}));
  app.get('/api/access',(_req,res) => res.json({kind:res.locals.workspace === 'public' ? 'public' : 'judge',videoUrl:options.videoUrl || null}));
  app.get('/api/people', (_req,res) => res.json(db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id = ? ORDER BY name COLLATE NOCASE').all(res.locals.workspace)));
  app.get('/api/home',(_req,res) => res.json({
    todos:db.prepare("SELECT id,text,due_on FROM todos WHERE workspace_id = ? AND status = 'open' ORDER BY due_on").all(res.locals.workspace),
    conversations:db.prepare('SELECT id,title,summary FROM conversations WHERE workspace_id = ? ORDER BY happened_on DESC').all(res.locals.workspace),
    peopleCount:(db.prepare('SELECT count(*) AS n FROM people WHERE workspace_id = ?').get(res.locals.workspace) as {n:number}).n,
  }));
  app.use('/api', (_req,res) => res.status(404).json({error:'Not found'}));
  app.use(express.static(path.resolve('dist')));
  app.get(['/', '/home', '/people', '/todos', '/connect'], (_req,res) => res.sendFile('index.html', {root:path.resolve('dist')}));
  app.use((err: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
    res.status(err instanceof SyntaxError ? 400 : 500).json({error:'This request could not be completed.'});
  });
  return app;
}
