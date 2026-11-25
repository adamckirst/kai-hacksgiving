import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { openDatabase,seed } from '../src/server/db';
import { createApp } from '../src/server/app';
test('configured Welcome video serves a generated MP4 with byte-range support; helper scripts parse',async()=> {
  mkdirSync('.data',{recursive:true});const directory=mkdtempSync('.data/video-check-'),file=resolve(directory,'demo.mp4');
  execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=gray:s=160x160:r=1','-t','1','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',file]);
  for(const script of ['scripts/upload-demo.sh','scripts/start-sprite.sh','scripts/save-links.sh'])execFileSync('bash',['-n',script]);
  const db=openDatabase();seed(db);const app=createApp(db,{videoUrl:'/demo.mp4',videoFile:file});const server=app.listen(18532,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const response=await fetch('http://127.0.0.1:18532/demo.mp4',{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');assert.ok(response.headers.get('content-range')?.startsWith('bytes 0-31/'));assert.equal((await response.arrayBuffer()).byteLength,32);
    assert.equal((await (await fetch('http://127.0.0.1:18532/api/access')).json()).videoUrl,'/demo.mp4');
  }finally{await app.locals.queue.stop();await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();rmSync(directory,{recursive:true,force:true});}
});
