import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { openDatabase, seed } from '../src/server/db';
import { createApp } from '../src/server/app';
test('every registered route refuses public writes; access requires the judge secret',async () => {
  const db=openDatabase(); seed(db);
  const secret=randomBytes(32).toString('hex');
  const app=createApp(db,{judgeSecret:secret,videoUrl:'https://example.invalid/demo.mp4'});
  const server=app.listen(18521,'127.0.0.1');
  await new Promise<void>(resolve => server.once('listening',resolve));
  const base='http://127.0.0.1:18521';
  try {
    // Discover the actual registered routes so new endpoints join this fence check.
    const routes=app.router.stack.flatMap((layer:{route?:{path:string|string[]}}) => layer.route ? [layer.route.path].flat() : []);
    assert.ok(routes.includes('/api/access/start'));
    for (const route of routes) {
      for (const method of ['POST','PUT','PATCH','DELETE']) {
        const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:'{}'});
        assert.equal(response.status,['/in/:address','/mcp/:address'].includes(route) ? 404:403,`${method} ${route} refuses the public copy`);
      }
    }
    assert.equal((db.prepare("SELECT count(*) AS n FROM workspaces WHERE kind='judge'").get() as {n:number}).n,0);
    assert.equal((await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid'},body:JSON.stringify({secret})})).status,403);
    const login=await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie')!;
    assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('SameSite=Strict'));
    const session=cookie.split(';')[0];
    assert.equal((await (await fetch(base+'/api/access',{headers:{Cookie:session}})).json()).kind,'judge');
    assert.equal((await (await fetch(base+'/api/access',{headers:{Cookie:session+'tampered'}})).json()).kind,'public');
    assert.equal((await (await fetch(base+'/api/access',{headers:{Cookie:'kai_session=%'}})).json()).kind,'public');
    const access=await (await fetch(base+'/api/access')).json();
    assert.equal(access.videoUrl,'https://example.invalid/demo.mp4');
    for (const route of ['/api/access','/api/home','/api/people']) {
      const text=await (await fetch(base+route,{headers:{Cookie:session}})).text();
      assert.ok(!text.includes(secret));
      assert.ok(!text.includes('upload_token'));assert.ok(!text.includes('mcp_token'));
    }
    assert.equal((await fetch(base+'/api/access/start',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  } finally {await new Promise<void>(resolve => server.close(() => resolve()));db.close();}
});
