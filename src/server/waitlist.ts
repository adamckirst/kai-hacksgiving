import express,{type Express,type Request,type Response} from 'express';
import {normalizeIp} from './trial';
import { randomBytes,createHmac } from 'node:crypto';
import { z } from 'zod';
import type { KaiDatabase } from './db';
import { equalSecret } from './access';
const hour=3600000,cookieName='kai_visitor';
type Visitor={seen:number;attempts:number[]};
type Visitors=Record<string,Visitor>;
type Options={trialsPaused?:boolean;downloadSecret?:string;judgeSecret?:string;secureCookies?:boolean;xPostUrl?:string;now?:()=>number};
function cookie(req:Request) {
  const value=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value:undefined;
}
function visitors(db:KaiDatabase,now:number):Visitors {
  const row=db.prepare("SELECT waitlist_visitors FROM workspaces WHERE id='public'").get() as {waitlist_visitors:string};
  const all=JSON.parse(row.waitlist_visitors) as Visitors;
  return Object.fromEntries(Object.entries(all).filter(([,v])=>v.seen>now-hour).map(([id,v])=>[id,{seen:v.seen,attempts:v.attempts.filter(at=>at>now-hour)}]));
}
function saveVisitors(db:KaiDatabase,all:Visitors) {db.prepare("UPDATE workspaces SET waitlist_visitors=? WHERE id='public'").run(JSON.stringify(all));}
export function xPost(value?:string) {
  if(!value)return null;
  try {const url=new URL(value);return url.protocol==='https:' && ['x.com','www.x.com'].includes(url.hostname) && /^\/[A-Za-z0-9_]+\/status\/\d+\/?$/.test(url.pathname) ? url.origin+url.pathname:null;}catch{return null;}
}
const address=z.object({email:z.string().trim().max(254).email().transform(value=>value.toLowerCase()),trial:z.boolean().optional()}).strict();

export function mountWaitlist(app:Express,db:KaiDatabase,options:Options) {
  const now=options.now ?? Date.now;
  app.get('/api/waitlist',(req,res)=> {
    const id=db.transaction(()=> {
      const at=now(),all=visitors(db,at);let id=cookie(req);
      if(!id || !all[id]) {
        if(Object.keys(all).length>=2000)return null;
        id=randomBytes(32).toString('hex');
      }
      all[id]={seen:at,attempts:all[id]?.attempts ?? []};saveVisitors(db,all);return id;
    })();
    if(!id){res.status(429).json({error:'The list is busy. Please try again later.'});return;}
    res.cookie(cookieName,id,{httpOnly:true,secure:options.secureCookies ?? true,sameSite:'strict',path:'/',maxAge:14*24*hour});
    res.json({xPostUrl:xPost(options.xPostUrl)});
  });
  app.post('/api/waitlist',(req,res,next)=> {
    const origin=req.get('origin');
    if(origin && origin!==`${options.secureCookies===false ? req.protocol:'https'}://${req.get('host')}`){res.status(403).json({error:'This request is not allowed.'});return;}
    const allowed=db.transaction(()=> {
      const at=now(),all=visitors(db,at),id=cookie(req);
      if(!id || !all[id])return 'missing';
      const visitor=all[id];visitor.seen=at;
      if(visitor.attempts.length>=5){saveVisitors(db,all);return 'limited';}
      visitor.attempts.push(at);saveVisitors(db,all);return 'yes';
    })();
    if(allowed==='missing'){res.status(403).json({error:'Reload this page before trying again.'});return;}
    if(allowed==='limited'){res.status(429).json({error:'Please wait an hour, then reload this page.'});return;}
    next();
  },express.json({limit:'1kb'}),(req,res)=> {
    const parsed=address.safeParse(req.body);
    if(!parsed.success){res.status(400).json({error:'Enter an email address of at most 254 characters.'});return;}
    if(parsed.data.trial){res.status(503).json({error:'Trial signups are paused while email verification is added. Please look around for now.'});return;}
    const saved=db.transaction(()=> {
      const {email}=parsed.data;
      if(db.prepare('SELECT 1 FROM waitlist WHERE email=?').get(email))return true;
      if((db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n>=2000)return false;
      db.prepare('INSERT INTO waitlist(email,created_at) VALUES (?,?)').run(email,new Date(now()).toISOString());return true;
    })();
    if(!saved){res.status(409).json({error:'The list is full. Please try again later.'});return;}
    res.json({ok:true});
  });
  function operator(req:Request,res:Response) {
    const supplied=req.get('x-kai-download');
    if(!options.downloadSecret || options.downloadSecret===options.judgeSecret || !supplied || !equalSecret(supplied,options.downloadSecret)) {res.status(404).json({error:'Not found.'});return false;}return true;
  }
  app.get('/api/operator/network',(req,res)=> {
    if(!operator(req,res))return;
    const ip=normalizeIp(req.get('sprite-client-ip')??'');
    const proof=(value:string)=>{const normalized=normalizeIp(value);return normalized ? createHmac('sha256',options.downloadSecret!).update('network-check:'+normalized).digest('hex'):null;};
    res.json({valid:Boolean(ip),fingerprint:ip ? proof(ip):null,headerNames:Object.keys(req.headers).filter(name=>/forward|client|real|sprite|fly/i.test(name)),forwarded:(req.get('x-forwarded-for')??'').split(',').map(value=>proof(value.trim())),real:proof(req.get('x-real-ip')??''),peer:proof(req.socket.remoteAddress??'')});
  });
  app.get('/api/operator/count',(req,res)=> {
    if(!operator(req,res))return;
    res.json({count:(db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n});
  });
  app.get('/api/operator/download',(req,res)=> {
    if(!operator(req,res))return;
    const rows=db.prepare('SELECT email FROM waitlist ORDER BY created_at,email').all() as {email:string}[];
    res.set({'Content-Type':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="kai-waitlist.txt"'}).send(rows.map(row=>row.email).join('\n')+(rows.length ? '\n':''));
  });
}
