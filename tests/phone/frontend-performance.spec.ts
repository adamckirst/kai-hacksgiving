import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {createJudge} from '../../src/server/access';

const attached='10000000-0000-4000-8000-000000000001';
const deferred=()=>{let release!:()=>void;return {promise:new Promise<void>(r=>{release=r}),release:()=>release()}};

for(const path of ['/upload/new','/upload/'+attached]) {
 test(`type choice and source loading at ${path} need one parallel data round after access`,async({page})=>{
  const gate=deferred(),started=new Set<string>();let accesses=0,connections=0;
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url()).pathname;
   if(url==='/api/access'){accesses++;await route.fulfill({json:{kind:'judge',trialSeconds:1700}});return;}
   if(url==='/api/notifications/count'){await route.fulfill({json:{unread:0}});return;}
   if(url==='/api/uploads'){await route.fulfill({json:[]});return;}
   if(url==='/api/connect')connections++;
   started.add(url);await gate.promise;
   if(url==='/api/people')await route.fulfill({json:[]});
   else if(url==='/api/connect')await route.fulfill({json:{shortcutReady:true}});
   else if(url==='/api/readings/'+attached)await route.fulfill({json:{id:attached,title:'Invented shared memo',awaiting_person:1,status:'waiting'}});
   else await route.fulfill({status:404,json:{error:'Invented missing route'}});
  });
  try {
   await page.goto(path);
   // Both requests must begin before either can finish. Serial fetching deadlocks here.
   await expect.poll(()=>[...started].sort()).toEqual(['/api/people',path.endsWith('/new')?'/api/connect':'/api/readings/'+attached].sort());
   expect(accesses).toBe(1);if(!path.endsWith('/new'))expect(connections).toBe(0);
  }finally{gate.release();}
  await expect(page.getByRole('heading',{name:path.endsWith('/new')?'Choose a recording from Files':'What kind of recording?'})).toBeVisible();await assertPhone(page);
 });
}

test('shortcut return checks for the attachment without fetching unrelated people or connection addresses',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()).pathname;requests.push(url);
  await route.fulfill({json:url==='/api/access'?{kind:'judge',trialSeconds:1700}:url==='/api/notifications/count'?{unread:0}:[]});
 });
 await page.goto('/upload');await expect(page.getByRole('heading',{name:'No recording waiting here'})).toBeVisible();
 expect(requests.filter(url=>url==='/api/access')).toHaveLength(1);
 expect(requests).not.toContain('/api/people');expect(requests).not.toContain('/api/connect');
});

test('a slow recording fetch never overlaps and finished recordings refresh immediately on returning to the tab',async({page})=>{
 let requests=0,active=0,peak=0,ready=false;const gate=deferred();
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()).pathname;
  if(url==='/api/access'){await route.fulfill({json:{kind:'judge',trialSeconds:1700}});return;}
  if(url==='/api/notifications/count'){await route.fulfill({json:{unread:0}});return;}
  if(url==='/api/waitlist'){await route.fulfill({json:{xPostUrl:null}});return;}
  if(url.endsWith('/seen')){await route.fulfill({json:{ok:true}});return;}
  if(url==='/api/readings/'+attached){
   requests++;active++;peak=Math.max(peak,active);await gate.promise;active--;
   await route.fulfill({json:{id:attached,title:'Invented short memo',summary:'First invented line.\nSecond invented line.',text:'Invented words.',status:ready?'ready':'reading',suggestions:[]}});return;
  }
  await route.fulfill({status:404,json:{error:'Invented missing route'}});
 });
 await page.goto('/recordings/'+attached);await expect.poll(()=>requests).toBe(1);
 try{await page.waitForTimeout(2200);expect(peak).toBe(1);expect(requests).toBe(1);}finally{ready=true;gate.release();}
 await expect(page.getByRole('heading',{name:'Invented short memo',exact:true})).toBeVisible();
 const before=requests;await page.waitForTimeout(2200);expect(requests).toBe(before);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(()=>requests).toBe(before+1);await assertPhone(page);
});

test('the notification badge loads only a count until its list is opened',async({page,context,kai})=>{
 const owner=createJudge(kai.db);await context.addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
 const requests:string[]=[];page.on('request',request=>requests.push(new URL(request.url()).pathname));
 await page.goto('/people');await expect(page.getByRole('link',{name:/^Notifications, \d+ unread$/})).toBeVisible();
 expect(requests).toContain('/api/notifications/count');expect(requests).not.toContain('/api/notifications');
 await page.getByRole('link',{name:/^Notifications/}).click();await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();
 await expect.poll(()=>requests.includes('/api/notifications')).toBe(true);await assertPhone(page);
});
