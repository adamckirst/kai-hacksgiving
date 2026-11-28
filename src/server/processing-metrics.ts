import type {KaiDatabase} from './db';

// Numeric timings and a fixed interruption category only. Never recording content,
// provider responses, addresses or credentials. Kept with (and deleted with) its row.
export type ProcessingObserver=(metric:'model_request_ms',milliseconds:number)=>void;
export type ProcessingMetrics={
 receivedAt?:number;requestedAt?:number;startedAt?:number;firstSuggestionAt?:number;readyAt?:number;finishedAt?:number;
 queueMs?:number;listeningMs?:number;readingMs?:number;modelRequestMs?:number;modelRequests?:number;
 speakerWaitStartedAt?:number;speakerWaitMs?:number;
 interruptions?:number;lastInterruption?:'timeout'|'restart';
};
export function getProcessingMetrics(db:KaiDatabase,id:string):ProcessingMetrics|undefined {
 const row=db.prepare('SELECT processing_metrics FROM conversations WHERE id=?').get(id) as {processing_metrics:string}|undefined;
 return row?JSON.parse(row.processing_metrics):undefined;
}
export function markProcessing(db:KaiDatabase,id:string,values:Partial<ProcessingMetrics>) {
 const previous=getProcessingMetrics(db,id);if(!previous)return;
 db.prepare('UPDATE conversations SET processing_metrics=? WHERE id=?').run(JSON.stringify({...previous,...values}),id);
}
export function observeProcessing(db:KaiDatabase,id:string):ProcessingObserver {
 return (_metric,milliseconds)=>{
  if(!Number.isFinite(milliseconds) || milliseconds<0)return;
  const previous=getProcessingMetrics(db,id);if(!previous)return;
  markProcessing(db,id,{modelRequests:(previous.modelRequests??0)+1,modelRequestMs:(previous.modelRequestMs??0)+Math.round(milliseconds)});
 };
}
export function timeProcessing(db:KaiDatabase,id:string,stage:'listeningMs'|'readingMs') {
 const started=performance.now();let ended=false;
 return ()=>{if(ended)return;ended=true;const previous=getProcessingMetrics(db,id);if(previous)markProcessing(db,id,{[stage]:(previous[stage]??0)+Math.round(performance.now()-started)});};
}
