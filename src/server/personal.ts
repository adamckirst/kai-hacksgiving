import {createHash,randomBytes} from 'node:crypto';
import express,{type Express,type Request} from 'express';
import {createJudge,equalSecret} from './access';
import type {KaiDatabase} from './db';
import {TERMS_VERSION} from '../terms';
export const setupCookie='kai_setup';
type Personal={workspace_id:string;setup_hash:string|null;email:string|null;verified_at:string|null};
export function personalInstance(db:KaiDatabase){return db.prepare('SELECT workspace_id,setup_hash,email,verified_at FROM personal_instance WHERE singleton=1').get() as Personal|undefined}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
/** Operator only, on an empty database. Caller handles the private return value. */
export function initializePersonal(db:KaiDatabase){return db.transaction(()=>{
 if(personalInstance(db) || db.prepare("SELECT 1 FROM workspaces WHERE kind='judge'").get() || db.prepare('SELECT 1 FROM waitlist').get())throw Error('Personal setup requires a fresh database. Existing notebooks are unchanged.');
 const value=randomBytes(32).toString('hex'),workspace=createJudge(db,false).id;
 db.prepare('INSERT INTO personal_instance(singleton,workspace_id,setup_hash) VALUES (1,?,?)').run(workspace,hash(value));return value;
})()}
export function validSetup(db:KaiDatabase,req:Request){
 const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(setupCookie+'='))?.slice(setupCookie.length+1);
 const p=personalInstance(db);return Boolean(p && !p.verified_at && p.setup_hash && raw && /^[a-f0-9]{64}$/.test(raw) && equalSecret(hash(raw),p.setup_hash));
}
export function claimPersonalOwner(db:KaiDatabase,email:string,workspace:string,at:number){
 const changed=db.prepare('UPDATE personal_instance SET email=?,verified_at=?,setup_hash=NULL,terms_version=?,terms_accepted_at=? WHERE singleton=1 AND workspace_id=? AND verified_at IS NULL AND setup_hash IS NOT NULL').run(email,new Date(at).toISOString(),TERMS_VERSION,new Date(at).toISOString(),workspace);
 if(changed.changes!==1)return false;
 db.prepare('UPDATE workspaces SET trial_verified=1 WHERE id=?').run(workspace);return true;
}
export function mountPersonalSetup(app:Express,db:KaiDatabase,secure=true){
 app.get('/api/setup/session',(req,res)=>res.json({ready:validSetup(db,req)}));
 app.post('/api/setup/start',express.json({limit:'1kb'}),(req,res)=>{
  const origin=req.get('origin');if(origin && origin!==`${secure?'https':req.protocol}://${req.get('host')}`){res.status(403).json({error:'This request is not allowed.'});return;}
  const p=personalInstance(db),value=req.body?.setup;
  if(!p || p.verified_at || !p.setup_hash || typeof value!=='string' || !/^[a-f0-9]{64}$/.test(value) || !equalSecret(hash(value),p.setup_hash)){res.status(403).json({error:'This setup link is not available. Ask the instance owner.'});return;}
  res.cookie(setupCookie,value,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:1800000});res.json({ok:true});
 });
}
