import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {setTimeout as wait} from 'node:timers/promises';
import {openDatabase,seed} from '../src/server/db';
import {createJudge} from '../src/server/access';
import {addAudio,queueWorker,fakeTranscriber} from '../src/server/audio';
import {fakeReader} from '../src/server/fake-reader';
import {testTone} from '../src/server/gateway';
import {getProcessingMetrics,observeProcessing,markProcessing} from '../src/server/processing-metrics';
import {retryReading} from '../src/server/reading';

test('processing measurements persist numbers and fixed reasons, separating transcription, reading and cleanup',async()=>{
 mkdirSync('.data',{recursive:true});const directory=mkdtempSync('.data/metrics-check-'),db=openDatabase();seed(db);const owner=createJudge(db);
 const [id]=await addAudio(db,owner.id,[{name:'invented.wav',buffer:testTone(),date:Date.now()}],directory);
 const worker=queueWorker(db,async(input,call,signal,observe)=>{observe?.('model_request_ms',12);await wait(8);await fakeReader(input,call,signal);},async(...args)=>{await wait(8);return fakeTranscriber(...args)});
 try{
  await worker.kick();const metrics=getProcessingMetrics(db,id)!;
  assert.ok(metrics.requestedAt!>=metrics.receivedAt!);assert.ok(metrics.startedAt!>=metrics.requestedAt!);assert.ok(metrics.firstSuggestionAt!>=metrics.startedAt!);assert.ok(metrics.readyAt!>=metrics.firstSuggestionAt!);assert.ok(metrics.finishedAt!>=metrics.readyAt!);
  assert.ok(metrics.listeningMs!>=5);assert.ok(metrics.readingMs!>=5);assert.equal(metrics.modelRequests,1);assert.equal(metrics.modelRequestMs,12);
  assert.ok(Object.values(metrics).every(value=>typeof value==='number'));
  const restored=openDatabase(db.serialize());try{assert.deepEqual(getProcessingMetrics(restored,id),metrics);}finally{restored.close()}
  // Automatic restart reasons survive the next attempt, unlike failure_code.
  db.prepare("UPDATE conversations SET status='reading',attempts=1 WHERE id=?").run(id);
  const restarted=queueWorker(db,fakeReader,fakeTranscriber);await restarted.kick();await restarted.stop();
  assert.equal(getProcessingMetrics(db,id)?.lastInterruption,'restart');assert.equal(getProcessingMetrics(db,id)?.interruptions,1);
  db.prepare("UPDATE conversations SET status='failed' WHERE id=?").run(id);retryReading(db,owner.id,id);
  const retry=getProcessingMetrics(db,id)!;assert.equal(retry.receivedAt,metrics.receivedAt);assert.ok(retry.requestedAt!>=metrics.requestedAt!);assert.equal(retry.firstSuggestionAt,undefined);assert.equal(retry.modelRequests,undefined);
  const observer=observeProcessing(db,id);observer('model_request_ms',NaN);assert.equal(getProcessingMetrics(db,id)?.modelRequests,undefined);
  db.prepare('DELETE FROM suggestions WHERE conversation_id=?').run(id);db.prepare('DELETE FROM conversations WHERE id=?').run(id);observer('model_request_ms',5);markProcessing(db,id,{readyAt:Date.now()});assert.equal(getProcessingMetrics(db,id),undefined);
 }finally{await worker.stop();db.close();rmSync(directory,{recursive:true,force:true});}
});
