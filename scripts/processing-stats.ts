import Database from 'better-sqlite3';
import type {ProcessingMetrics} from '../src/server/processing-metrics';

// Read-only aggregate diagnostics. No notebook IDs, text, titles, addresses,
// provider responses or absolute timestamps are selected for output.
const db=new Database(process.env.KAI_DB??'/home/sprite/kai-state/kai.sqlite',{readonly:true,fileMustExist:true});
try{
 const rows=db.prepare("SELECT status,processing_metrics FROM conversations WHERE processing_metrics!='{}' ORDER BY rowid DESC LIMIT 20").all() as {status:string;processing_metrics:string}[];
 const metrics=rows.filter(row=>row.status==='ready').map(row=>JSON.parse(row.processing_metrics) as ProcessingMetrics);
 const median=(values:(number|undefined)[])=>{const sorted=values.filter((value):value is number=>typeof value==='number' && Number.isFinite(value) && value>=0).sort((a,b)=>a-b);return sorted.length?Math.round((sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2):null;};
 const elapsed=(m:ProcessingMetrics,end:number|undefined)=>m.requestedAt && end?Math.max(0,end-m.requestedAt-(m.speakerWaitMs??0)):undefined;
 console.log(JSON.stringify({measuredRecordings:rows.length,readyRecordings:metrics.length,failedRecordings:rows.filter(r=>r.status==='failed').length,medianQueueMs:median(metrics.map(m=>m.queueMs)),medianListeningMs:median(metrics.map(m=>m.listeningMs)),medianReadingMs:median(metrics.map(m=>m.readingMs)),medianFirstSuggestionMs:median(metrics.map(m=>elapsed(m,m.firstSuggestionAt))),medianReadyMs:median(metrics.map(m=>elapsed(m,m.readyAt))),medianModelRequests:median(metrics.map(m=>m.modelRequests)),automaticInterruptions:rows.reduce((sum,r)=>sum+((JSON.parse(r.processing_metrics) as ProcessingMetrics).interruptions??0),0)},null,2));
}finally{db.close()}
