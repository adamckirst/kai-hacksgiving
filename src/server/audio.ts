import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseBuffer } from 'music-metadata';
import type { KaiDatabase } from './db';
import { ReadingError, reserveReading, reserveRecording, readConversation, type Reader } from './reading';
import { linkRecordingPerson } from './recording-person';
import { samples } from '../samples';
import { discoverGateways, gatewayRequest } from './gateway';
export const maxAudioBytes=10_000_000;
export type AudioInput={name:string;buffer:Buffer;date:number};
export type Transcriber=(audio:Buffer,signal:AbortSignal)=>Promise<string>;
export const fakeTranscriber:Transcriber=async()=>samples[0].text;
export async function addAudio(db:KaiDatabase,workspace:string,files:AudioInput[],directory:string,source:'recording'|'shared'='recording',options:{person?:unknown;awaitingPerson?:boolean}={}) {
  if(files.length<1 || files.length>5) throw new ReadingError('Choose between one and five recordings.');
  for(const file of files) {
    if(!/\.(m4a|opus|ogg|mp3|wav)$/i.test(file.name) || !file.buffer.length || file.buffer.length>maxAudioBytes) throw new ReadingError('Use m4a, opus, ogg, mp3 or wav files, each up to 10 MB.');
    if(!Number.isFinite(file.date) || file.date<0 || file.date>Date.now()+86400000) throw new ReadingError('The recording date is not valid.');
    try {
      const {format}=await parseBuffer(file.buffer,{path:file.name,size:file.buffer.length},{duration:true,skipCovers:true});
      if(!format.duration || !Number.isFinite(format.duration) || format.duration>300 || !format.numberOfChannels) throw new Error();
    } catch {throw new ReadingError('Use an audio recording up to five minutes long.');}
  }
  mkdirSync(directory,{recursive:true,mode:0o700});
  const written:string[]=[];const batch=randomUUID();
  try {
    return db.transaction(()=>files.slice().sort((a,b)=>a.date-b.date).map(file=> {
      reserveRecording(db,workspace);reserveReading(db,workspace);
      const id=randomUUID(),audioPath=path.resolve(directory,id+'.audio');
      writeFileSync(audioPath,file.buffer,{mode:0o600,flag:'wx'});written.push(audioPath);
      db.prepare('INSERT INTO conversations (id,workspace_id,title,summary,source,text,happened_on,status,audio_path,happened_at,batch_id,awaiting_person,reserved_on) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,workspace,'New recording','',source,'',new Date(file.date).toISOString().slice(0,10),'waiting',audioPath,file.date,batch,options.awaitingPerson ? 1:0,new Date().toISOString().slice(0,10));
      if(options.person!==undefined)linkRecordingPerson(db,workspace,id,options.person);
      return id;
    }))();
  } catch(error) {for(const file of written) if(existsSync(file)) unlinkSync(file);throw error;}
}
export const assemblyTranscriber:Transcriber=async(audio,signal)=> {
  const {assemblyai}=await discoverGateways();
  const uploaded=await gatewayRequest(assemblyai,'/v2/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(audio),signal});
  const job=await gatewayRequest(assemblyai,'/v2/transcript',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio_url:uploaded.upload_url,speech_models:['assemblyai-stt-3-7']}),signal});
  if(typeof job.id!=='string' || !/^[a-zA-Z0-9-]+$/.test(job.id)) throw new Error('Listening could not start.');
  try {
    for(;;) {
      signal.throwIfAborted();
      const result=await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`,{signal});
      if(result.status==='completed') {
        if(typeof result.text!=='string' || result.text.length>20000 || result.audio_duration>300) throw new Error('Recording exceeds the limits.');
        return result.text;
      }
      if(result.status==='error') throw new Error('Listening failed.');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  } finally {
    // Remove the provider's transcript as well; never log its body.
    try {await gatewayRequest(assemblyai,`/v2/transcript/${job.id}`,{method:'DELETE'});} catch {console.error('Provider transcript cleanup failed.');}
  }
};
type Job={id:string;workspace_id:string;audio_path:string|null;status:string;attempts:number;text:string;transcribed:number};
export function queueWorker(db:KaiDatabase,reader:Reader,transcribe:Transcriber) {
  let active:Promise<void>|undefined,stopped=false;
  const controller=new AbortController();
  function retryInterrupted(job:Job) {
    if(job.attempts>=2) {db.prepare("UPDATE conversations SET status='failed',error='KAI could not finish. Try again.' WHERE id=?").run(job.id);return;}
    try {db.transaction(()=> {
      reserveReading(db,job.workspace_id);if(job.audio_path && !job.transcribed) reserveRecording(db,job.workspace_id);
      db.prepare("UPDATE conversations SET status='waiting',progress=NULL WHERE id=?").run(job.id);
    })();} catch {db.prepare("UPDATE conversations SET status='failed',error='KAI has reached today’s limit. Try tomorrow.' WHERE id=?").run(job.id);}
  }
  // One server owns this database. A new process means these leases were interrupted.
  for(const job of db.prepare("SELECT * FROM conversations WHERE status IN ('listening','reading')").all() as Job[]) retryInterrupted(job);
  function kick() {
    if(active || stopped) return active ?? Promise.resolve();
    active=(async()=> {
      for(;;) {
        if(stopped) return;
        const job=db.prepare("SELECT * FROM conversations WHERE status='waiting' AND awaiting_person=0 ORDER BY happened_at,rowid LIMIT 1").get() as Job|undefined;
        if(!job) return;
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120000)]);
        db.prepare('UPDATE conversations SET attempts=attempts+1 WHERE id=?').run(job.id);
        try {
          if(job.audio_path && !job.transcribed) {
            db.prepare("UPDATE conversations SET status='listening' WHERE id=?").run(job.id);
            const words=await transcribe(readFileSync(job.audio_path),signal);signal.throwIfAborted();
            if(words.length>20000) throw new Error();
            // Persist words first: a restart after this line never needs to listen again.
            db.prepare('UPDATE conversations SET text=?,transcribed=1 WHERE id=?').run(words,job.id);
          }
          if(job.audio_path) {
            if(existsSync(job.audio_path)) unlinkSync(job.audio_path);
            db.prepare('UPDATE conversations SET audio_path=NULL WHERE id=?').run(job.id);
          }
          await readConversation(db,job.id,reader,signal);
          if(signal.aborted && !stopped) retryInterrupted(db.prepare('SELECT * FROM conversations WHERE id=?').get(job.id) as Job);
        } catch {
          if(stopped) return;
          if(signal.aborted) retryInterrupted(db.prepare('SELECT * FROM conversations WHERE id=?').get(job.id) as Job);
          else db.prepare("UPDATE conversations SET status='failed',error='KAI could not listen to this recording. Try again.' WHERE id=?").run(job.id);
        }
      }
    })().finally(()=>{active=undefined;});
    return active;
  }
  return {kick,stop:async()=>{stopped=true;controller.abort();await active;}};
}
