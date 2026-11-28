import type {KaiDatabase} from './db';
import {addReading,ReadingError} from './reading';
import {samples} from '../samples';

export function onboardingState(db:KaiDatabase,workspace:string) {
 const owner=db.prepare('SELECT trial_verified,trial_seconds,shortcut_ready,assistant_onboarding_done FROM workspaces WHERE id=?').get(workspace) as {trial_verified:number;trial_seconds:number|null;shortcut_ready:number;assistant_onboarding_done:number}|undefined;
 const first=db.prepare("SELECT id,status,awaiting_person,awaiting_speakers FROM conversations WHERE workspace_id=? AND source IN ('recording','shared','sample') ORDER BY rowid LIMIT 1").get(workspace) as {id:string;status:string;awaiting_person:number;awaiting_speakers:number}|undefined;
 const eligible=Boolean(owner?.trial_verified && owner.trial_seconds!==null);
 return {needsShortcut:eligible && !first && !owner?.shortcut_ready,needsRecording:eligible && !first,
  assistantRecordingId:eligible && !owner?.assistant_onboarding_done && first && !first.awaiting_person && !first.awaiting_speakers && first.status!=='failed'?first.id:null};
}

export function finishOnboarding(db:KaiDatabase,workspace:string) {
 if(db.prepare('SELECT 1 FROM workspaces WHERE id=? AND trial_verified=1 AND assistant_onboarding_done=1').get(workspace))return;
 const state=onboardingState(db,workspace);
 if(!state.assistantRecordingId)throw new ReadingError('Start your first recording or example before finishing setup.',409);
 db.prepare('UPDATE workspaces SET assistant_onboarding_done=1 WHERE id=?').run(workspace);
}

export function addOnboardingExample(db:KaiDatabase,workspace:string) {
 return db.transaction(()=>{
  const row=db.prepare('SELECT trial_verified FROM workspaces WHERE id=?').get(workspace) as {trial_verified:number}|undefined;
  if(!row?.trial_verified)throw new ReadingError('Open your verified notebook to try the example.',403);
  const existing=db.prepare("SELECT id,source FROM conversations WHERE workspace_id=? AND source IN ('recording','shared','sample') ORDER BY rowid LIMIT 1").get(workspace) as {id:string;source:string}|undefined;
  if(existing){if(existing.source==='sample')return existing.id;throw new ReadingError('Your first recording is already here. Open it from Home.',409);}
  const example=samples.find(s=>s.id==='sora')!;
  return addReading(db,workspace,example.text,new Date().toISOString().slice(0,10),'sample');
 })();
}
