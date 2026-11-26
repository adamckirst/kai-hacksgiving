import { photograph } from './photos';
import { test,expect } from './fixture';
import { assertPhone } from './usability';
import { testTone } from '../../src/server/gateway';

async function login(page:any,secret:string) {
  await page.goto('/');await page.evaluate((s:string)=>{history.replaceState(null,'','/#judge='+s);location.reload();},secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
}

test('choose a new person before upload; their page keeps the recording after reload',async({page,kai})=> {
  await login(page,kai.secret);await page.getByRole('link',{name:'Add recordings',exact:true}).click();
  await page.getByRole('button',{name:/^Voice note from someone else/}).click();await page.getByLabel('Who is speaking?').selectOption('new');await assertPhone(page);
  await page.getByLabel('Name',{exact:true}).fill('Avery Fern');await page.getByLabel('Company (optional)').fill('Juniper Dental');await photograph(page,'upload-new-person');
  await page.getByLabel('Add recordings: choose up to five audio files').setInputFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
  await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();await page.getByRole('link',{name:'Avery Fern',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Avery Fern',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('link',{name:/A follow-up with Dana/})).toBeVisible();await assertPhone(page);
});

test('WhatsApp handoff waits for person choice and resumes the attached recording',async({page,kai})=> {
  await login(page,kai.secret);
  // An interrupted navigation must not mark the attachment as already opened.
  let interrupted=false,resolveInterrupted!:()=>void;const interruptedNavigation=new Promise<void>(resolve=>{resolveInterrupted=resolve;});await page.route('**/upload/*',async route=>{if(!interrupted){interrupted=true;await route.fulfill({status:503,contentType:'text/html',body:'<p>Upload temporarily unavailable</p>'});resolveInterrupted();}else await route.continue();});
  const response=await page.request.get('/api/connect');const {uploadPath}=await response.json();
  const posted=await page.request.post(uploadPath,{multipart:{recordings:{name:'invented.wav',mimeType:'audio/wav',buffer:testTone()},date:new Date(Date.now()-1000).toISOString()}});
  expect(posted.status()).toBe(202);const {ids}=await posted.json();
  const before=await page.request.get('/api/readings/'+ids[0]);expect((await before.json()).awaiting_person).toBe(1);
  await interruptedNavigation;await expect(page.getByText('Upload temporarily unavailable',{exact:true})).toBeVisible();await page.goto('/home');await expect(page).toHaveURL(new RegExp('/upload/'+ids[0]),{timeout:10000});expect(interrupted).toBe(true);
  await expect(page.getByText('Your recording is attached and waiting for you.')).toBeVisible();await assertPhone(page);await photograph(page,'upload-shared');
  const people=await (await page.request.get('/api/people')).json();
  await page.getByRole('button',{name:/^Voice note from someone else/}).click();await page.getByLabel('Who is speaking?').selectOption(people.find((p:any)=>p.name==='Dana Whitfield').id);
  await page.getByRole('button',{name:'Let KAI read',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/recordings/'+ids[0]));await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
  await expect(page.getByRole('link',{name:'Dana Whitfield',exact:true})).toBeVisible();await assertPhone(page);
  await page.goto('/home');await expect(page.getByText('No recording at hand?',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/suggestions to review/})).toBeVisible();
});

test('Home puts recording progress first, then my tasks, excluding promises owed by others',async({page,kai})=> {
  await login(page,kai.secret);
  await page.route('**/api/queue',r=>r.fulfill({json:[{id:'invented',title:'An invented recording',status:'reading',progress:'Reading Dana’s page',error:null}]}));
  await page.goto('/home');await expect(page.getByText('Reading Dana’s page',{exact:true})).toBeVisible();
  const tasks=page.getByRole('region',{name:'My tasks',exact:true});await expect(tasks).toContainText('Send Dana the pricing');await expect(tasks).not.toContainText('Send the trial dates');
  const progress=await page.getByText('Reading Dana’s page',{exact:true}).boundingBox(),todos=await tasks.boundingBox(),samples=await page.getByText('No recording at hand?',{exact:true}).boundingBox();
  expect(progress!.y).toBeLessThan(todos!.y);expect(todos!.y).toBeLessThan(samples!.y);await expect(page.getByText('Up to five recordings at once',{exact:true})).toHaveCount(0);await assertPhone(page);
  await page.getByRole('checkbox',{name:'Mark Send Dana the pricing done'}).click();await expect(tasks).not.toContainText('Send Dana the pricing');
  await page.reload();await expect(page.getByRole('region',{name:'My tasks'})).not.toContainText('Send Dana the pricing');
});

test('opening another page holds its loading screen and URL instead of flashing Welcome',async({page})=> {
  let release!:()=>void;const gate=new Promise<void>(r=>{release=r});
  await page.route('**/api/access',async r=>{await gate;await r.continue()});
  await page.goto('/people');await expect(page.getByRole('status')).toHaveText('Opening people…');
  await expect(page).toHaveURL(/\/people$/);await expect(page.getByRole('link',{name:'Look around',exact:true})).toHaveCount(0);await assertPhone(page);await photograph(page,'opening-page');
  release();await expect(page.getByRole('link',{name:/Dana Whitfield/})).toBeVisible();
});
