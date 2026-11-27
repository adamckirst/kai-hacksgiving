import {MAX_AUDIO_SECONDS,MAX_AUDIO_TEXT} from '../limits';
import {queueQuotaEmail} from './quota-mail';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';
import type { KaiDatabase } from './db';
import { ReadingError, reserveReading, reserveRecording, readConversation, type Reader } from './reading';
import { configureRecording } from './recording-person';
import { samples } from '../samples';
import { discoverGateways, gatewayRequest } from './gateway';
export const maxAudioBytes=10_000_000;
export type AudioInput={name:string;buffer:Buffer;date:number};
export type Utterance={speaker:string;text:string;start:number;end:number};
export type Transcript={text:string;utterances:Utterance[]};
export type Transcriber=(audio:Buffer,signal:AbortSignal,reservedSeconds?:number,multiple?:boolean)=>Promise<string|Transcript>;
export const fakeTranscriber:Transcriber=async(_audio,_signal,_seconds,multiple)=>multiple ? {text:samples[0].text,utterances:[{speaker:'A',text:samples[0].text.split('\n')[0],start:0,end:1000},{speaker:'B',text:samples[0].text.split('\n').slice(1).join('\n') || 'Thanks.',start:1000,end:2000}]}:samples[0].text;
export async function addAudio(db:KaiDatabase,workspace:string,files:AudioInput[],directory:string,source:'recording'|'shared'='recording',options:{person?:unknown;awaitingPerson?:boolean}={}) {
  if(files.length<1 || files.length>5) throw new ReadingError('Choose between one and five recordings.');
  let tooLong=false;let seconds=0;const durations=new Map<AudioInput,number>();
  for(const file of files) {
    if(!/\.(m4a|opus|ogg|mp3|wav)$/i.test(file.name) || !file.buffer.length || file.buffer.length>maxAudioBytes) throw new ReadingError('Use m4a, opus, ogg, mp3 or wav files, each up to 10 MB.');
    if(!Number.isFinite(file.date) || file.date<0 || file.date>Date.now()+86400000) throw new ReadingError('The recording date is not valid.');
    try {
      const {format}=await parseBuffer(file.buffer,{path:file.name,size:file.buffer.length},{duration:true,skipCovers:true});
      if(!format.duration || !Number.isFinite(format.duration) || format.duration<=0 || !format.numberOfChannels) throw new Error();
      if(format.duration>=MAX_AUDIO_SECONDS)tooLong=true;
      const duration=Math.ceil(format.duration);seconds+=duration;durations.set(file,duration);
    } catch {throw new ReadingError('Use a valid audio recording shorter than 30 minutes.');}
  }
  mkdirSync(directory,{recursive:true,mode:0o700});
  const written:string[]=[];const batch=randomUUID();
  try {
    return db.transaction(()=> {
      const trial=db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(workspace) as {trial_seconds:number|null}|undefined;
      if(trial?.trial_seconds!=null) {
        if(seconds>trial.trial_seconds)throw new QuotaExceeded(seconds,trial.trial_seconds);
        db.prepare('UPDATE workspaces SET trial_seconds=trial_seconds-? WHERE id=?').run(seconds,workspace);
      }
      if(tooLong)throw new ReadingError('Each recording must be shorter than 30 minutes.');
      return files.slice().sort((a,b)=>a.date-b.date).map(file=> {
      reserveRecording(db,workspace);reserveReading(db,workspace);
      const id=randomUUID(),audioPath=path.resolve(directory,id+'.audio');
      writeFileSync(audioPath,file.buffer,{mode:0o600,flag:'wx'});written.push(audioPath);
      db.prepare('INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status,audio_path,happened_at,batch_id,awaiting_person,reserved_on) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,workspace,'New recording','',source,'',new Date(file.date).toISOString().slice(0,10),'waiting',audioPath,file.date,batch,options.awaitingPerson ? 1:0,new Date().toISOString().slice(0,10));
      db.prepare('UPDATE conversations SET reserved_seconds=? WHERE id=?').run(durations.get(file),id);
      db.prepare('UPDATE conversations SET notify_ready=1 WHERE id=? AND EXISTS (SELECT 1 FROM waitlist WHERE workspace_id=? AND verified_at IS NOT NULL)').run(id,workspace);
      if(options.person!==undefined)configureRecording(db,workspace,id,options.person);
      return id;
    });})();
  } catch(error) {if(error instanceof QuotaExceeded)queueQuotaEmail(db,workspace,files.map(f=>f.buffer),error.requested,error.remaining);for(const file of written) if(existsSync(file)) unlinkSync(file);throw error;}
}
export class QuotaExceeded extends ReadingError {constructor(public requested:number,public remaining:number){super(`This exceeds your remaining recording time (${Math.floor(remaining/60)} min ${remaining%60} sec). Choose a shorter recording.`,429)}}
export class AudioDurationError extends Error {}
/** Fixed categories only. Never retain provider messages or recording content. */
export class ListeningFailure extends Error {constructor(public code:string){super(code)}}
function listeningCode(error:unknown) {
  if(error instanceof ListeningFailure)return error.code;
  if(error instanceof AudioDurationError)return 'audio_duration';
  if(error instanceof Error && /^Connector request failed \((\d{3})\)\.$/.test(error.message))return 'listening_http_'+error.message.match(/\d{3}/)![0];
  return 'listening_failed';
}
export const assemblyTranscriber:Transcriber=async(audio,signal,reservedSeconds=MAX_AUDIO_SECONDS,multiple=false)=> {
  if(!Number.isInteger(reservedSeconds) || reservedSeconds<1 || reservedSeconds>MAX_AUDIO_SECONDS)throw new Error('Invalid recording reservation.');
  const {assemblyai}=await discoverGateways();
  const uploaded=await gatewayRequest(assemblyai,'/v2/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(audio),signal});
  const job=await gatewayRequest(assemblyai,'/v2/transcript',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio_url:uploaded.upload_url,speech_models:['assemblyai-stt-3-7'],audio_start_from:0,audio_end_at:reservedSeconds*1000,...(multiple ? {speaker_labels:true}:{})}),signal});
  if(typeof job.id!=='string' || !/^[a-zA-Z0-9-]+$/.test(job.id)) throw new Error('Listening could not start.');
  try {
    for(;;) {
      signal.throwIfAborted();
      const result=await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`,{signal});
      if(result.status==='completed') {
        if(typeof result.audio_duration!=='number' || !Number.isFinite(result.audio_duration) || result.audio_duration<0 || result.audio_duration>reservedSeconds)throw new AudioDurationError('Recording exceeds its reserved time.');
        if(typeof result.text!=='string' || result.text.length>MAX_AUDIO_TEXT || result.audio_duration>MAX_AUDIO_SECONDS) throw new Error('Recording exceeds the limits.');
        if(multiple) {
          const utterances=result.utterances;
          if(!Array.isArray(utterances) || !utterances.length || utterances.length>2000)throw new ListeningFailure('speakers_missing');
          const clean:Utterance[]=utterances.map(u=>{
            if(!u || typeof u.speaker!=='string' || !/^[A-Z]{1,3}$/.test(u.speaker))throw new ListeningFailure('speaker_label_invalid');
            if(typeof u.text!=='string' || !u.text.trim() || u.text.length>MAX_AUDIO_TEXT)throw new ListeningFailure('speaker_text_invalid');
            if(!Number.isFinite(u.start) || !Number.isFinite(u.end) || u.start<0 || u.end<u.start || u.end>reservedSeconds*1000+1000)throw new ListeningFailure('speaker_time_invalid');
            return {speaker:u.speaker,text:u.text,start:u.start,end:u.end};
          });
          if(new Set(clean.map(u=>u.speaker)).size>20 || clean.reduce((n,u)=>n+u.text.length,0)>MAX_AUDIO_TEXT*2)throw new ListeningFailure('speaker_limit');
          return {text:result.text,utterances:clean};
        }
        return result.text;
      }
      if(result.status==='error') throw new ListeningFailure('listening_provider_error');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  } finally {
    // Remove the provider's transcript as well; never log its body.
    try {await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`,{method:'DELETE'});} catch {console.error('Provider transcript cleanup failed.');}
  }
};
type Job={recording_type:string|null;id:string;workspace_id:string;audio_path:string|null;status:string;attempts:number;text:string;transcribed:number;reserved_seconds:number|null};
export function queueWorker(db:KaiDatabase,reader:Reader,transcribe:Transcriber,onReady:()=>void=()=>{}) {
  let active:Promise<void>|undefined,stopped=false,again=false;
  const controller=new AbortController();
  function retryInterrupted(job:Job) {
    if(job.attempts>=2) {db.prepare("UPDATE conversations SET status='failed',error='KAI could not finish. Try again.' WHERE id=?").run(job.id);return;}
    try {db.transaction(()=> {
      reserveReading(db,job.workspace_id);if(job.audio_path && !job.transcribed) reserveRecording(db,job.workspace_id);
      db.prepare("UPDATE conversations SET status='waiting',progress=NULL WHERE id=?").run(job.id);
    })();} catch {db.prepare("UPDATE conversations SET status='failed',error='KAI has reached today’s limit. Try tomorrow.' WHERE id=?").run(job.id);}
  }
  // Finish audio cleanup after a crash between saving labelled words and deleting audio.
  for(const row of db.prepare('SELECT id,audio_path FROM conversations WHERE transcribed=1 AND awaiting_speakers=1').all() as {id:string;audio_path:string|null}[]) {
    if(row.audio_path && existsSync(row.audio_path))unlinkSync(row.audio_path);
    db.prepare("UPDATE conversations SET audio_path=NULL,status='waiting',progress='Choose who is speaking' WHERE id=?").run(row.id);
  }
  // One server owns this database. A new process means these leases were interrupted.
  for(const job of db.prepare("SELECT * FROM conversations WHERE status IN ('listening','reading')").all() as Job[]) retryInterrupted(job);
  function kick() {
    if(stopped)return active ?? Promise.resolve();
    if(active){again=true;return active;}
    active=(async()=> {
      for(;;) {
        if(stopped) return;
        const job=db.prepare("SELECT * FROM conversations WHERE status='waiting' AND awaiting_person=0 AND awaiting_speakers=0 AND workspace_id IN (SELECT id FROM workspaces WHERE trial_ended=0 AND (trial_seconds IS NULL OR trial_verified=1)) ORDER BY happened_at,rowid LIMIT 1").get() as Job|undefined;
        if(!job) return;
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(Math.max(120000,Math.min(600000,(job.reserved_seconds??0)*1000)))]);
        db.prepare('UPDATE conversations SET attempts=attempts+1 WHERE id=?').run(job.id);
        try {
          if(job.audio_path && !job.transcribed) {
            db.prepare("UPDATE conversations SET status='listening' WHERE id=?").run(job.id);
            const audio=readFileSync(job.audio_path);
            // Older waiting recordings were charged by the same metadata parser.
            const seconds=job.reserved_seconds ?? Math.ceil((await parseBuffer(audio,undefined,{duration:true,skipCovers:true})).format.duration ?? 0);
            const transcript=await transcribe(audio,signal,seconds,job.recording_type==='multiple');signal.throwIfAborted();
            const words=typeof transcript==='string' ? transcript:transcript.text;
            const utterances=typeof transcript==='string' ? []:transcript.utterances;
            if(job.recording_type==='multiple' && !utterances.length)throw new ListeningFailure('speakers_missing');
            if(words.length>MAX_AUDIO_TEXT) throw new Error();
            // Persist words first: a restart after this line never needs to listen again.
            db.prepare('UPDATE conversations SET text=?,transcribed=1,utterances=?,awaiting_speakers=? WHERE id=?').run(words,JSON.stringify(utterances),Number(job.recording_type==='multiple'),job.id);
          }
          if(job.audio_path) {
            if(existsSync(job.audio_path)) unlinkSync(job.audio_path);
            db.prepare('UPDATE conversations SET audio_path=NULL WHERE id=?').run(job.id);
          }
          const pending=db.prepare('SELECT awaiting_speakers FROM conversations WHERE id=?').get(job.id) as {awaiting_speakers:number};
          if(pending.awaiting_speakers){db.prepare("UPDATE conversations SET status='waiting',progress='Choose who is speaking' WHERE id=?").run(job.id);continue;}
          await readConversation(db,job.id,reader,signal);
          onReady();
          if(signal.aborted && !stopped) retryInterrupted(db.prepare('SELECT * FROM conversations WHERE id=?').get(job.id) as Job);
        } catch(error) {
          db.prepare('UPDATE conversations SET failure_code=? WHERE id=?').run(signal.aborted ? 'listening_timeout':listeningCode(error),job.id);
          if(error instanceof AudioDurationError) {
            db.prepare('UPDATE workspaces SET trial_ended=1,trial_seconds=0 WHERE id=? AND trial_seconds IS NOT NULL').run(job.workspace_id);
          }
          if(stopped) return;
          if(signal.aborted) retryInterrupted(db.prepare('SELECT * FROM conversations WHERE id=?').get(job.id) as Job);
          else db.prepare("UPDATE conversations SET status='failed',error='KAI could not listen to this recording. Try again.' WHERE id=?").run(job.id);
          if((db.prepare('SELECT status FROM conversations WHERE id=?').get(job.id) as {status:string}).status==='failed')onReady();
        }
      }
    })().finally(()=>{active=undefined;if(again && !stopped){again=false;return kick();}});
    return active;
  }
  return {kick,stop:async()=>{stopped=true;controller.abort();await active;}};
}
