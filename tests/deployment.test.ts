import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databasePath, persistentJudgeSecret } from '../src/server/config';
import { openDatabase, seed } from '../src/server/db';
import { gatewayUrl, testTone } from '../src/server/gateway';
import { execFileSync } from 'node:child_process';
test('production refuses a missing or in-checkout database',() => {
  assert.equal(databasePath({}),':memory:');
  for(const file of [undefined,':memory:','local.sqlite',process.cwd()+'/data.sqlite']) assert.throws(()=>databasePath({NODE_ENV:'production',KAI_DB:file}));
  assert.equal(databasePath({NODE_ENV:'production',KAI_DB:'/home/sprite/kai-state/kai.sqlite'}),'/home/sprite/kai-state/kai.sqlite');
});
test('invitation stays stable across repeated initialization',() => {
  const db=openDatabase();seed(db);
  try {const first=persistentJudgeSecret(db);assert.equal(first.length,64);assert.ok(first===persistentJudgeSecret(db));assert.equal((db.prepare('SELECT count(*) AS n FROM workspaces').get() as {n:number}).n,1);} finally {db.close();}
});
test('gateway addresses cannot redirect calls to a provider or arbitrary host',()=> {
  const base='https://api.sprites.dev/v1/gateway/anthropic/invented-connection';
  assert.equal(gatewayUrl(base+'/','anthropic'),base);
  for(const address of ['https://example.invalid/v1/gateway/anthropic/invented-connection',base+'?key=no',base+'/v1/messages',base.replace('anthropic','assemblyai')]) assert.throws(()=>gatewayUrl(address,'anthropic'));
});
test('the listening ping makes a two-second WAV in memory',()=> {
  const audio=testTone();assert.equal(audio.toString('ascii',0,4),'RIFF');assert.equal(audio.toString('ascii',8,12),'WAVE');
  assert.equal(audio.readUInt32LE(40)/audio.readUInt32LE(28),2);assert.equal(audio.length,64044);
});
test('deployment shell scripts parse',()=> {
  for(const file of ['scripts/deploy.sh','scripts/deploy-on-sprite.sh','scripts/start-sprite.sh']) execFileSync('bash',['-n',file]);
});
