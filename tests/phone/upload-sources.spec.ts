import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {testTone} from '../../src/server/gateway';

test('three audio sources show guidance and return from shortcut setup to the chosen app',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.goto('/upload/new');
 for(const name of ['Voice Memos','WhatsApp','Files']){
  await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  await page.getByRole('button',{name:'How to add from '+name}).click();
  await expect(page.getByRole('heading',{name:'From '+name,exact:true})).toBeVisible();await assertPhone(page);
 }
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();
 await page.route('**/api/connect',async route=>{const r=await route.fetch();const data=await r.json();await route.fulfill({json:{...data,uploadPath:'/in/layout-example',mcpPath:'/mcp/layout-example'}})});
 await page.getByRole('link',{name:'Set up shortcut',exact:true}).click();await expect(page).toHaveURL(/connect\?next=whatsapp$/);
 await page.getByRole('button',{name:'I’ve added the shortcut',exact:true}).click();
 await expect(page).toHaveURL(/upload\/new\?source=whatsapp$/);
 await expect(page.getByRole('link',{name:'Open WhatsApp',exact:true})).toHaveAttribute('href','whatsapp://app');await assertPhone(page);
 await page.getByRole('button',{name:'Voice Memos',exact:true}).click();
 await expect(page.getByRole('link',{name:'Open Voice Memos',exact:true})).toHaveAttribute('href','voicememos://');
 await page.getByRole('button',{name:'Files',exact:true}).click();
 const picker=page.getByLabel('Add recordings: choose up to five audio files');await expect(picker).toHaveAttribute('accept','.m4a,.opus,.ogg,.mp3,.wav');
 await picker.setInputFiles({name:'invented.txt',mimeType:'text/plain',buffer:Buffer.from('Invented words.')});
 await expect(page.getByText('Choose an audio file: M4A, OPUS, OGG, MP3 or WAV.',{exact:true})).toBeVisible();await expect(page).toHaveURL(/upload\/new/);
 await assertPhone(page);
});

test('remaining time refuses an oversized duration, hides a missing post, and lets reserved shared audio finish',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 const cookie=(await page.context().cookies()).find(c=>c.name==='kai_session')!;const id=cookie.value.split('.')[0];
 kai.db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=1 WHERE id=?').run(id);
 await page.goto('/upload/new');await expect(page.getByText('0 min 1 sec of recording time left',{exact:true})).toBeVisible();
 await page.getByLabel('Add recordings: choose up to five audio files').setInputFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
 await expect(page.getByText(/remaining recording time/)).toBeVisible();
 expect((kai.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(id) as {trial_seconds:number}).trial_seconds).toBe(1);
 kai.db.prepare('UPDATE workspaces SET trial_seconds=2 WHERE id=?').run(id);
 const connection=await (await page.request.get('/api/connect')).json();
 const r=await page.request.post(connection.uploadPath,{multipart:{recordings:{name:'invented.wav',mimeType:'audio/wav',buffer:testTone()},date:new Date().toISOString()}});expect(r.status()).toBe(202);const {ids}=await r.json();
 // The last two seconds are already reserved. The attached recording must still be startable.
 await page.goto('/upload/'+ids[0]);await expect(page.getByRole('button',{name:'Let KAI read',exact:true})).toBeEnabled();await assertPhone(page);
 await page.getByRole('button',{name:'Let KAI read',exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
 await page.goto('/upload/new');await expect(page.getByRole('heading',{name:'Your hour is complete'})).toBeVisible();await expect(page.getByRole('link',{name:'Show KAI some love'})).toHaveCount(0);await assertPhone(page);
 await page.goto('/home');await expect(page.getByRole('link',{name:'Show KAI some love'})).toHaveCount(0);
});
