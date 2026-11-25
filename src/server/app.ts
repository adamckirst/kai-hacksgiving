import express from 'express';
import path from 'node:path';
import type { KaiDatabase } from './db';
import { addReading, retryReading, ReadingError, type Reader } from './reading';
import { fakeReader } from './fake-reader';
import { samples } from '../samples';
import multer from 'multer';
import { addAudio, queueWorker, fakeTranscriber, maxAudioBytes, type Transcriber } from './audio';
import { cookieName, createJudge, equalSecret, workspaceFor } from './access';
export type AppOptions = {judgeSecret?:string; videoUrl?:string; secureCookies?:boolean;reader?:Reader;transcriber?:Transcriber;audioDirectory?:string};
export function createApp(db: KaiDatabase, options: AppOptions = {}) {
  const app = express();
  const queue=queueWorker(db,options.reader ?? fakeReader,options.transcriber ?? fakeTranscriber);
  const work=queue.kick;app.locals.queue=queue;void work();
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:maxAudioBytes,files:5,fields:1,fieldSize:1024,parts:6}}).array('recordings',5);
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
  app.use((_req,_res,next)=>{void work();next();});
  app.get('/healthz', (_req,res) => res.json({status:'ok',commit:process.env.KAI_COMMIT ?? 'local'}));
  app.get('/api/access',(_req,res) => res.json({kind:res.locals.workspace === 'public' ? 'public' : 'judge',videoUrl:options.videoUrl || null}));
  app.get('/api/people', (_req,res) => res.json(db.prepare('SELECT id,name,company,role FROM people WHERE workspace_id = ? ORDER BY name COLLATE NOCASE').all(res.locals.workspace)));
  app.get('/api/home',(_req,res) => res.json({
    todos:db.prepare("SELECT id,text,due_on FROM todos WHERE workspace_id = ? AND status = 'open' ORDER BY due_on").all(res.locals.workspace),
    conversations:db.prepare('SELECT id,title,summary FROM conversations WHERE workspace_id = ? ORDER BY happened_on DESC').all(res.locals.workspace),
    peopleCount:(db.prepare('SELECT count(*) AS n FROM people WHERE workspace_id = ?').get(res.locals.workspace) as {n:number}).n,
  }));
  app.post('/api/recordings',upload,async(req,res) => {
    try {
      const files=req.files as Express.Multer.File[]|undefined;
      const dates=JSON.parse(req.body?.dates ?? '[]');
      if(!files || !Array.isArray(dates) || dates.length!==files.length) throw new ReadingError('Choose recordings with their dates.');
      const ids=await addAudio(db,res.locals.workspace,files.map((f,i)=>({name:f.originalname,buffer:f.buffer,date:dates[i]})),options.audioDirectory ?? '.data/audio');
      res.status(202).json({ids});void work();
    } catch(error) {
      if(error instanceof ReadingError) res.status(error.status).json({error:error.message});
      else if(error instanceof SyntaxError) res.status(400).json({error:'The recording dates could not be read.'});else throw error;
    }
  });
  app.get('/api/queue',(_req,res)=>res.json(db.prepare("SELECT id,title,status,error FROM conversations WHERE workspace_id=? AND (status IN ('waiting','listening','reading','failed') OR batch_id IN (SELECT batch_id FROM conversations WHERE status IN ('waiting','listening','reading'))) ORDER BY happened_at,rowid").all(res.locals.workspace)));
  app.post('/api/readings',(req,res) => {
    try {
      const sample=samples.find(s=>s.id===req.body?.sample_id);
      const text=sample?.text ?? req.body?.text;
      if(typeof text!=='string' || typeof req.body?.happened_on!=='string' || (req.body.sample_id && !sample)) throw new ReadingError('Choose a sample or add your words and date.');
      const id=addReading(db,res.locals.workspace,text,req.body.happened_on,sample ? 'sample':'paste');
      res.status(202).json({id});void work();
    } catch(error) {if(error instanceof ReadingError) res.status(error.status).json({error:error.message});else throw error;}
  });
  app.post('/api/readings/:id/retry',(req,res) => {
    try {retryReading(db,res.locals.workspace,req.params.id);res.status(202).json({ok:true});void work();}
    catch(error) {if(error instanceof ReadingError) res.status(error.status).json({error:error.message});else throw error;}
  });
  app.get('/api/readings/:id',(req,res) => {
    const row=db.prepare('SELECT id,title,summary,text,happened_on,status,error FROM conversations WHERE id=? AND workspace_id=?').get(req.params.id,res.locals.workspace);
    if(!row) {res.status(404).json({error:'Recording not found.'});return;}
    const suggestions=db.prepare('SELECT id,kind,payload,quote,status FROM suggestions WHERE conversation_id=? AND workspace_id=? ORDER BY rowid').all(req.params.id,res.locals.workspace);
    res.json({...row,suggestions});
  });
  app.use('/api', (_req,res) => res.status(404).json({error:'Not found'}));
  app.use(express.static(path.resolve('dist')));
  app.get(['/', '/home', '/people', '/todos', '/connect', '/recordings/:id'], (_req,res) => res.sendFile('index.html', {root:path.resolve('dist')}));
  app.use((err: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
    if(err instanceof multer.MulterError) {res.status(400).json({error:'Choose up to five recordings, each up to 10 MB.'});return;}
    res.status(err instanceof SyntaxError ? 400 : 500).json({error:'This request could not be completed.'});
  });
  return app;
}
