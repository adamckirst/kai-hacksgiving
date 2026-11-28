import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visiblePoll} from '../src/visible-poll';

class Visibility extends EventTarget {visibilityState='visible';}
const flush=async()=>{await Promise.resolve();await Promise.resolve();};

test('polls never overlap slow requests and a pending foreground refresh runs immediately afterwards',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const visibility=new Visibility(),lifecycle=new EventTarget();
 let reads=0,finish!:()=>void;
 const poll=visiblePoll(async()=>{reads++;await new Promise<void>(r=>{finish=r})},1000,visibility,lifecycle);
 assert.equal(reads,1);t.mock.timers.tick(5000);assert.equal(reads,1);
 lifecycle.dispatchEvent(new Event('focus'));lifecycle.dispatchEvent(new Event('pageshow'));assert.equal(reads,1);
 finish();await flush();assert.equal(reads,2);
 finish();await flush();t.mock.timers.tick(999);assert.equal(reads,2);t.mock.timers.tick(1);assert.equal(reads,3);
 poll.stop();finish();await flush();t.mock.timers.tick(5000);assert.equal(reads,3);
});

test('hidden tabs pause, visible tabs refresh immediately, and stopping aborts the pending read',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const visibility=new Visibility(),lifecycle=new EventTarget();visibility.visibilityState='hidden';
 let reads=0,lastSignal:AbortSignal|undefined;
 const poll=visiblePoll(async signal=>{reads++;lastSignal=signal},15000,visibility,lifecycle);
 assert.equal(reads,0);t.mock.timers.tick(60000);assert.equal(reads,0);
 visibility.visibilityState='visible';visibility.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(reads,1);
 t.mock.timers.tick(1000);assert.equal(reads,1);
 visibility.visibilityState='hidden';visibility.dispatchEvent(new Event('visibilitychange'));t.mock.timers.tick(60000);assert.equal(reads,1);
 visibility.visibilityState='visible';visibility.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(reads,2);
 poll.stop();assert.equal(lastSignal!.aborted,true);lifecycle.dispatchEvent(new Event('pageshow'));t.mock.timers.tick(60000);assert.equal(reads,2);
});
