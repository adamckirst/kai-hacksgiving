import {test,expect} from './fixture';
import {createJudge} from '../../src/server/access';
import {testTone} from '../../src/server/gateway';
import {assertPhone} from './usability';
import {randomUUID} from 'node:crypto';
import {TERMS_VERSION} from '../../src/terms';

for(const path of ['/upload','/upload/new?onboarding=1','/upload/new']) {
 test(`a shared recording arriving after ${path} opens reaches type choice without processing`,async({page,context,kai})=>{
  const owner=createJudge(kai.db,false);
  await context.addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
  const {uploadPath}=await(await page.request.get('/api/connect')).json();
  let documents=0,accesses=0;page.on('request',request=>{if(request.resourceType()==='document')documents++;if(new URL(request.url()).pathname==='/api/access')accesses++;});
  await page.goto(path);
  if(path==='/upload')await expect(page.getByRole('heading',{name:'No recording waiting here'})).toBeVisible();
  else await expect(page.getByRole('heading',{name:path.includes('onboarding')?'Share your first recording':'Choose a recording from Files'})).toBeVisible();
  await assertPhone(page);
  const posted=await page.request.post(uploadPath,{multipart:{recordings:{name:'invented.wav',mimeType:'audio/wav',buffer:testTone()},date:new Date().toISOString()}});
  expect(posted.status()).toBe(202);const {ids,openPath}=await posted.json();expect(openPath).toBe('/upload/'+ids[0]);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect(page).toHaveURL(new RegExp('/upload/'+ids[0]+'$'));
  await expect(page.getByRole('heading',{name:'What kind of recording?'})).toBeVisible();
  expect(documents).toBe(1);expect(accesses).toBe(1);
  await expect(page.getByRole('button',{name:'Let KAI read',exact:true})).toBeDisabled();await assertPhone(page);
  const recording=await(await page.request.get('/api/readings/'+ids[0])).json();expect(recording.awaiting_person).toBe(1);expect(recording.status).toBe('waiting');expect(recording.text).toBe('');
 });
}

test('a return with no attachment explains notebook setup and cannot open another notebook’s upload',async({page,context,kai})=>{
 const other=createJudge(kai.db,false),owner=createJudge(kai.db,false);
 kai.db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,awaiting_person) VALUES ('other-shared',?,'Invented other recording','','shared','','2026-11-28','waiting',1)").run(other.id);
 await context.addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
 await page.goto('/upload');await expect(page.getByRole('heading',{name:'No recording waiting here'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Check sharing setup'})).toHaveAttribute('href','/connect?next=voice-memos');
 await expect(page.getByRole('heading',{name:'Choose a recording from Files'})).toHaveCount(0);
 await expect(page.getByText('Invented other recording')).toHaveCount(0);await assertPhone(page);
 await page.getByRole('button',{name:'Check again'}).click();await expect(page.getByRole('heading',{name:'No recording waiting here'})).toBeVisible();
 await page.goto('/upload/other-shared');await expect(page.getByText('Your upload could not open. Try again.')).toBeVisible();
});

test('shared-return sign-in preserves the destination and opens only the verified notebook’s attachment',async({page,kai})=>{
 const owner=createJudge(kai.db,false),email=randomUUID()+'@example.invalid',recording=randomUUID();
 kai.db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=1800 WHERE id=?').run(owner.id);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?)').run(email,'2026-11-28',owner.id,'2026-11-28',TERMS_VERSION,'2026-11-28');
 kai.db.prepare("INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status,awaiting_person) VALUES (?,?,'Invented shared recording','','shared','','2026-11-28','waiting',1)").run(recording,owner.id);
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.201'});
 await page.goto('/upload');await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send verification code'}).click();
 await expect(page.getByLabel('Verification code')).toBeVisible();await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify email'}).click();
 await expect(page).toHaveURL(new RegExp('/upload/'+recording+'$'));await expect(page.getByRole('heading',{name:'What kind of recording?'})).toBeVisible();await assertPhone(page);
});

test('checking failure recovers and a shared arrival cannot replace a file already chosen locally',async({page,context,kai})=>{
 const owner=createJudge(kai.db,false);await context.addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
 const fail=async(route:import('@playwright/test').Route)=>route.fulfill({status:503,json:{error:'Invented outage'}});
 await page.route('**/api/uploads',fail);await page.goto('/upload');await expect(page.getByRole('alert')).toContainText('KAI could not check');await assertPhone(page);
 await page.unroute('**/api/uploads',fail);await page.getByRole('button',{name:'Check again'}).click();await expect(page.getByRole('heading',{name:'No recording waiting here'})).toBeVisible();
 await page.goto('/upload/new');await page.getByLabel('Add recording: choose one audio file').setInputFiles({name:'local-invented.wav',mimeType:'audio/wav',buffer:testTone()});
 await expect(page.getByText('Chosen from Files',{exact:true})).toBeVisible();
 const {uploadPath}=await(await page.request.get('/api/connect')).json();
 const posted=await page.request.post(uploadPath,{multipart:{recordings:{name:'shared-invented.wav',mimeType:'audio/wav',buffer:testTone()},date:new Date().toISOString()}});expect(posted.status()).toBe(202);
 const {ids}=await posted.json();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 // Let a full polling interval elapse: the local selection must remain intact.
 await page.waitForTimeout(1200);await expect(page).toHaveURL(/\/upload\/new$/);await expect(page.getByRole('heading',{name:'local-invented.wav'})).toBeVisible();
 await page.goto('/upload');await expect(page).toHaveURL(new RegExp('/upload/'+ids[0]+'$'));
});
