import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {testTone} from '../../src/server/gateway';

test('App shelf puts Files first and returns from sharing setup to each source',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.goto('/upload/new');
 await expect(page.getByRole('link',{name:'Telegram',exact:true})).toHaveCount(0);
 await expect(page.getByText('One audio file · up to 10 MB · under 30 minutes',{exact:true})).toHaveCount(1);
 for(const name of ['Voice Memos','WhatsApp','Messages']){await page.getByRole('button',{name:'How to add from '+name}).click();await expect(page.getByRole('heading',{name:'From '+name,exact:true})).toBeVisible();await expect(page.getByRole('dialog').getByRole('link',{name:'Set up the KAI shortcut for iOS',exact:true})).toHaveAttribute('href','/connect?next='+(name==='Voice Memos'?'voice-memos':name.toLowerCase()));await assertPhone(page);await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'How to add from '+name})).toBeFocused()}
 await page.route('**/api/connect',async route=>{const r=await route.fetch();const data=await r.json();await route.fulfill({json:{...data,uploadPath:'/in/layout-example',mcpPath:'/mcp/layout-example'}})});
 await page.getByRole('link',{name:'WhatsApp',exact:true}).click();await expect(page).toHaveURL(/connect\?next=whatsapp$/);
 await page.getByRole('checkbox',{name:'I already have the shortcut set up'}).click();await expect(page.getByRole('checkbox')).toBeChecked();await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Back to upload'}).click();await expect(page).toHaveURL(/upload\/new\?source=whatsapp$/);await page.getByRole('button',{name:'Dismiss instructions'}).click();
 await expect(page.locator('[aria-label="Share from an app"] img')).toHaveCount(3);await expect.poll(()=>page.locator('[aria-label="Share from an app"] img').evaluateAll(images=>images.every(img=>(img as HTMLImageElement).naturalWidth>0))).toBe(true);
 for(const [name,url] of [['WhatsApp','whatsapp://app'],['Messages','sms:']])await expect(page.getByRole('link',{name,exact:true})).toHaveAttribute('href',url);
 await page.getByRole('button',{name:/^Voice Memos/}).click();await expect(page.getByText('Open Voice Memos from your Home Screen and choose a recording.',{exact:true})).toBeVisible();await expect(page.locator('a[href^="voicememos:"]')).toHaveCount(0);await assertPhone(page);
 await page.getByRole('button',{name:'Dismiss instructions'}).click();
 const picker=page.getByLabel('Add recording: choose one audio file');await expect(picker).not.toHaveAttribute('multiple');await expect(picker).toHaveAttribute('accept','.m4a,.opus,.ogg,.mp3,.wav');
 await picker.setInputFiles({name:'invented.txt',mimeType:'text/plain',buffer:Buffer.from('Invented words.')});await expect(page.getByText('Choose an audio file: M4A, OPUS, OGG, MP3 or WAV.',{exact:true})).toBeVisible();await assertPhone(page);
});

test('remaining time refuses an oversized duration, hides a missing post, and lets reserved shared audio finish',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 const cookie=(await page.context().cookies()).find(c=>c.name==='kai_session')!;const id=cookie.value.split('.')[0];
 kai.db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=1 WHERE id=?').run(id);
 await page.goto('/upload/new');await expect(page.getByText('0 min 1 sec of recording time left',{exact:true})).toBeVisible();
 await page.getByLabel('Add recording: choose one audio file').setInputFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
 await page.getByRole('button',{name:/^My memo/}).click();await page.getByRole('button',{name:'Let KAI read',exact:true}).click();
 await expect(page.getByText(/remaining recording time/)).toBeVisible();
 expect((kai.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(id) as {trial_seconds:number}).trial_seconds).toBe(1);
 kai.db.prepare('UPDATE workspaces SET trial_seconds=2 WHERE id=?').run(id);
 const connection=await (await page.request.get('/api/connect')).json();
 const r=await page.request.post(connection.uploadPath,{multipart:{recordings:{name:'invented.wav',mimeType:'audio/wav',buffer:testTone()},date:new Date().toISOString()}});expect(r.status()).toBe(202);const {ids}=await r.json();
 // The last two seconds are already reserved. The attached recording must still be startable.
 await page.goto('/upload/'+ids[0]);await page.getByRole('button',{name:/^My memo/}).click();await expect(page.getByRole('button',{name:'Let KAI read',exact:true})).toBeEnabled();await assertPhone(page);
 await page.getByRole('button',{name:'Let KAI read',exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
 await page.goto('/upload/new');await expect(page.getByRole('heading',{name:'Your trial time is complete'})).toBeVisible();await expect(page.getByRole('link',{name:'Show KAI some love'})).toHaveCount(0);await assertPhone(page);
 await page.goto('/home');await expect(page.getByRole('link',{name:'Show KAI some love'})).toHaveCount(0);
});
