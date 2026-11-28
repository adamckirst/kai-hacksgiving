import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import express from 'express';
import {serveAssets} from '../src/server/static-assets';

test('only content-hashed public assets are immutable; unchanged browser assets need no download',async()=>{
 mkdirSync('.data',{recursive:true});const directory=mkdtempSync('.data/asset-check-');
 writeFileSync(directory+'/app-a1b2C3d4.js','/* invented public asset */');writeFileSync(directory+'/plain.js','/* unversioned */');
 const app=express();app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});app.use('/assets',serveAssets(directory));app.get('/api/example',(_req,res)=>res.json({private:true}));
 const server=app.listen(18910,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const origin='http://127.0.0.1:18910';
 try{
  const first=await fetch(origin+'/assets/app-a1b2C3d4.js');assert.equal(first.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(await first.text(),'/* invented public asset */');
  const again=await fetch(origin+'/assets/app-a1b2C3d4.js',{headers:{'If-None-Match':first.headers.get('etag')!,'Cache-Control':'max-age=0'}});assert.equal(again.status,304);assert.equal(await again.text(),'');
  for(const path of ['/assets/plain.js','/api/example','/assets/missing.js'])assert.equal((await fetch(origin+path)).headers.get('cache-control'),'no-store');
 }finally{await new Promise<void>(r=>server.close(()=>r()));rmSync(directory,{recursive:true,force:true});}
});
