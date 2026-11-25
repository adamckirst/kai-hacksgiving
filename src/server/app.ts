import express from 'express';
import path from 'node:path';
import type { KaiDatabase } from './db';
import { addReading, retryReading, reserveReading, reserveRecording, ReadingError, type Reader } from './reading';
import { fakeReader } from './fake-reader';
import { samples } from '../samples';
import { decide,acceptAll,peopleList,personPage } from './decisions';
import multer from 'multer';
import { addAudio, queueWorker, fakeTranscriber, maxAudioBytes, type Transcriber } from './audio';
import { cookieName, createJudge, equalSecret, workspaceFor } from './access';
import { listTodos,finishTodo } from './todos';
import { mountSharing } from './sharing';
import { mountMcp } from './mcp';
import { mountWaitlist } from './waitlist';
import { linkRecordingPerson } from './recording-person';
export type AppOptions = {judgeSecret?:string; downloadSecret?:string; xPostUrl?:string; now?:()=>number; videoUrl?:string;videoFile?:string; secureCookies?:boolean;reader?:Reader;transcriber?:Transcriber;audioDirectory?:string};
export function createApp(db: KaiDatabase, options: AppOptions = {}) {
  const app = express();
  const queue=queueWorker(db,options.reader ?? fakeReader,options.transcriber ?? fakeTranscriber);
  const work=queue.kick;app.locals.queue=queue;void work();
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:maxAudioBytes,files:5,fields:2,fieldSize:2048,parts:7}}).array('recordings',5);
  app.disable('x-powered-by');
  app.use((_req,res,next) => {res.set({'Referrer-Policy':'no-referrer','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});next();});
  mountSharing(app,db,upload,options.audioDirectory ?? '.data/audio',work);
  mountMcp(app,db);
  mountWaitlist(app,db,options);
  // A 20,000-character transcript can need 120 KB when JSON escapes it.
  app.use(express.json({limit:'128kb'}));
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
  app.get('/healthz', (_req,res) => res.json({status:'ok',commit:process.env.KAI_COMMIT ?? 'local',reading:!options.reader || options.reader===fakeReader ? 'fake':'connector'}));
  app.get('/api/access',(_req,res) => res.json({kind:res.locals.workspace === 'public' ? 'public' : 'judge',videoUrl:options.videoUrl || null}));
  app.get('/api/connect',(_req,res)=> {
    const row=db.prepare("SELECT upload_token,mcp_token FROM workspaces WHERE id=? AND kind='judge'").get(res.locals.workspace) as {upload_token:string;mcp_token:string}|undefined;
    if(!row){res.status(403).json({error:'Open your own copy to connect your phone.'});return;}
    res.json({uploadPath:'/in/'+row.upload_token,mcpPath:'/mcp/'+row.mcp_token});
  });
  app.get('/api/people', (_req,res) => res.json(peopleList(db,res.locals.workspace)));
  app.get('/api/todos',(_req,res)=>res.json(listTodos(db,res.locals.workspace)));
  app.post('/api/todos/:id/done',(req,res)=> {
    try {finishTodo(db,res.locals.workspace,req.params.id);res.json({ok:true});}
    catch(error){if(error instanceof ReadingError)res.status(error.status).json({error:error.message});else throw error;}
  });
  app.get('/api/people/:id',(req,res)=> {
    const page=personPage(db,res.locals.workspace,req.params.id);
    if(!page){res.status(404).json({error:'Person not found.'});return;}res.json(page);
  });
  app.post('/api/suggestions/:id/decision',(req,res)=> {
    try {
      if(!['accept','reject'].includes(req.body?.decision) || (req.body.edits && (typeof req.body.edits!=='object' || Array.isArray(req.body.edits))))throw new ReadingError('Choose accept or reject.');
      decide(db,res.locals.workspace,req.params.id,req.body.decision,req.body.edits);res.json({ok:true});
    } catch(error){if(error instanceof ReadingError)res.status(error.status).json({error:error.message});else throw error;}
  });
  app.post('/api/readings/:id/accept-all',(req,res)=> {
    try {acceptAll(db,res.locals.workspace,req.params.id);res.json({ok:true});}
    catch(error){if(error instanceof ReadingError)res.status(error.status).json({error:error.message});else throw error;}
  });
  app.get('/api/home',(_req,res) => res.json({
    todos:db.prepare("SELECT t.id,t.text,t.due_on,p.name AS person_name FROM todos t LEFT JOIN people p ON p.id=t.person_id AND p.workspace_id=t.workspace_id WHERE t.workspace_id = ? AND t.status = 'open' AND t.owner_person_id IS NULL ORDER BY t.due_on IS NULL,t.due_on").all(res.locals.workspace),
    conversations:db.prepare('SELECT id,title,summary,happened_on FROM conversations WHERE workspace_id = ? ORDER BY happened_on DESC').all(res.locals.workspace),
    hasRecordings:Boolean(db.prepare("SELECT 1 FROM conversations WHERE workspace_id=? AND source IN ('recording','shared') LIMIT 1").get(res.locals.workspace)),
    peopleCount:(db.prepare('SELECT count(*) AS n FROM people WHERE workspace_id = ?').get(res.locals.workspace) as {n:number}).n,
  }));
  app.post('/api/recordings',upload,async(req,res) => {
    try {
      const files=req.files as Express.Multer.File[]|undefined;
      const dates=JSON.parse(req.body?.dates ?? '[]');
      if(!files || !Array.isArray(dates) || dates.length!==files.length) throw new ReadingError('Choose recordings with their dates.');
      const ids=await addAudio(db,res.locals.workspace,files.map((f,i)=>({name:f.originalname,buffer:f.buffer,date:dates[i]})),options.audioDirectory ?? '.data/audio','recording',{person:req.body?.person ? JSON.parse(req.body.person):undefined});
      res.status(202).json({ids});void work();
    } catch(error) {
      if(error instanceof ReadingError) res.status(error.status).json({error:error.message});
      else if(error instanceof SyntaxError) res.status(400).json({error:'The recording dates could not be read.'});else throw error;
    }
  });
  app.get('/api/queue',(_req,res)=>res.json(db.prepare(`SELECT c.id,c.title,c.status,c.error,c.progress,c.awaiting_person,
    (SELECT count(*) FROM suggestions s WHERE s.workspace_id=c.workspace_id AND s.conversation_id=c.id AND s.status='proposed') AS suggestion_count
    FROM conversations c WHERE c.workspace_id=? AND (c.status IN ('waiting','listening','reading','failed')
      OR c.batch_id IN (SELECT batch_id FROM conversations WHERE workspace_id=c.workspace_id AND status IN ('waiting','listening','reading'))
      OR (c.status='ready' AND (EXISTS(SELECT 1 FROM suggestions s WHERE s.workspace_id=c.workspace_id AND s.conversation_id=c.id AND s.status='proposed')
        OR c.rowid=(SELECT max(rowid) FROM conversations WHERE workspace_id=c.workspace_id AND source IN ('recording','shared')))))
    ORDER BY CASE c.status WHEN 'ready' THEN 1 ELSE 0 END,c.happened_at,c.rowid`).all(res.locals.workspace)));

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
  app.get('/api/uploads',(_req,res)=>res.json(db.prepare('SELECT id,title,happened_on FROM conversations WHERE workspace_id=? AND awaiting_person=1 ORDER BY rowid DESC').all(res.locals.workspace)));
  app.post('/api/uploads/:id/start',(req,res) => {
    try {
      db.transaction(()=> {
        const row=db.prepare('SELECT awaiting_person,reserved_on FROM conversations WHERE id=? AND workspace_id=?').get(req.params.id,res.locals.workspace) as {awaiting_person:number;reserved_on:string|null}|undefined;
        if(!row)throw new ReadingError('Recording not found.',404);
        if(!row.awaiting_person)return;
        const day=new Date().toISOString().slice(0,10);
        if(row.reserved_on && row.reserved_on!==day) {reserveRecording(db,res.locals.workspace);reserveReading(db,res.locals.workspace);}
        linkRecordingPerson(db,res.locals.workspace,req.params.id,req.body);
        db.prepare('UPDATE conversations SET awaiting_person=0,reserved_on=? WHERE id=? AND workspace_id=?').run(day,req.params.id,res.locals.workspace);
      })();
      res.json({id:req.params.id});void work();
    }
    catch(error) {if(error instanceof ReadingError)res.status(error.status).json({error:error.message});else throw error;}
  });
  app.get('/api/readings/:id',(req,res) => {
    const row=db.prepare('SELECT id,title,summary,text,happened_on,source,status,error,progress,person_id,awaiting_person FROM conversations WHERE id=? AND workspace_id=?').get(req.params.id,res.locals.workspace) as {person_id:string|null}|undefined;
    if(!row) {res.status(404).json({error:'Recording not found.'});return;}
    const suggestions=db.prepare('SELECT id,kind,payload,quote,status FROM suggestions WHERE conversation_id=? AND workspace_id=? ORDER BY rowid').all(req.params.id,res.locals.workspace);
    const person=row.person_id ? db.prepare('SELECT id,name,company,role FROM people WHERE id=? AND workspace_id=?').get(row.person_id,res.locals.workspace) ?? null:null;
    res.json({...row,person,suggestions});
  });
  app.get('/demo.mp4',(_req,res)=> {
    if(!options.videoFile){res.status(404).end();return;}
    res.sendFile(options.videoFile,{dotfiles:'allow'},error=>{if(error && !res.headersSent)res.status(404).end();});
  });
  app.use('/api', (_req,res) => res.status(404).json({error:'Not found'}));
  app.use(express.static(path.resolve('dist')));
  app.get(['/', '/home', '/upload', '/upload/:id', '/people', '/todos', '/connect', '/recordings/:id', '/people/:id', '/operator'], (_req,res) => res.sendFile('index.html', {root:path.resolve('dist')}));
  app.use((err: unknown,_req:express.Request,res:express.Response,_next:express.NextFunction) => {
    if(err instanceof multer.MulterError) {res.status(400).json({error:'Choose up to five recordings, each up to 10 MB.'});return;}
    res.status(err && typeof err==='object' && 'status' in err && err.status===413 ? 413:err instanceof SyntaxError ? 400 : 500).json({error:'This request could not be completed.'});
  });
  return app;
}
