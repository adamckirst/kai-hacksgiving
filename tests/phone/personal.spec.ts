import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {openDatabase,seed} from '../../src/server/db';
import {initializePersonal,personalInstance} from '../../src/server/personal';
import {createApp} from '../../src/server/app';
import {createJudge} from '../../src/server/access';

test('exhausted demo and settings open coding-agent instructions that copy and download at 375 px',async({page,kai})=>{
 const owner=createJudge(kai.db,false);kai.db.prepare('UPDATE workspaces SET trial_seconds=0,trial_verified=1 WHERE id=?').run(owner.id);await page.context().addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
 await page.goto('/home');await expect(page.getByRole('heading',{name:'Keep using KAI on your own Sprite'})).toBeVisible();await assertPhone(page);await page.getByRole('link',{name:'Run your own KAI',exact:true}).click();await expect(page.getByRole('heading',{name:'Run your own KAI'})).toBeVisible();await assertPhone(page);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{document.body.dataset.instructions=text}}}));await page.getByRole('button',{name:'Copy for your coding agent'}).click();await expect(page.getByRole('button',{name:'Instructions copied'})).toBeVisible();expect(await page.evaluate(()=>document.body.dataset.instructions)).toBe(readFileSync('SELF_HOST.md','utf8'));await assertPhone(page);
 const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'Download Markdown instructions'}).click();const file=await downloaded;expect(file.suggestedFilename()).toBe('KAI-SELF-HOST.md');expect(readFileSync((await file.path())!,'utf8')).toBe(readFileSync('SELF_HOST.md','utf8'));
 await page.reload();await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error()}}}));await page.getByRole('button',{name:'Copy for your coding agent'}).click();await expect(page.getByText('Copying is unavailable here. Download the Markdown instructions below.')).toBeVisible();await assertPhone(page);
 await page.goto('/connect');await page.getByRole('link',{name:'Run your own KAI',exact:true}).click();await expect(page).toHaveURL(/\/your-own-kai$/);
});
test('personal owner setup and recovery show personal terms, an empty notebook and no public signup',async({page})=>{
 const db=openDatabase();seed(db,new Date(),'public',false);const setup=initializePersonal(db),email=randomUUID()+'@example.invalid',codes=new Map<string,string>();let now=Date.now();
 const app=createApp(db,{secureCookies:false,now:()=>now,sendLogin:async(email,code)=>{codes.set(email,code)}});const server=app.listen(18636,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:18636';
 try{
  await page.goto(base+'/');await expect(page.getByRole('heading',{name:'Your own KAI'})).toBeVisible();await expect(page.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();await assertPhone(page);
  await page.goto(base+'/setup#setup='+setup);await expect(page.getByRole('button',{name:'Send sign-in code'})).toBeDisabled();await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('checkbox',{name:'I agree to the instance terms'}).check();await expect(page.getByRole('button',{name:'Send sign-in code'})).toBeEnabled();expect(page.url().includes(setup)).toBe(false);await assertPhone(page);
  await page.getByRole('button',{name:'Send sign-in code'}).click();await expect(page.getByLabel('Sign-in code')).toBeVisible();await page.getByLabel('Sign-in code').fill(codes.get(email)!);await page.getByRole('button',{name:'Sign in and open notebook'}).click();await expect(page.getByText('Your notebook starts here')).toBeVisible();await assertPhone(page);
  await expect(page.getByText(/30 min|8 December|Would you use something/)).toHaveCount(0);expect(personalInstance(db)?.email).toBe(email);expect((db.prepare('SELECT count(*) n FROM waitlist').get() as {n:number}).n).toBe(0);
  await page.goto(base+'/upload/new');await expect(page.getByText(/You control notebook storage and deletion/)).toBeVisible();await expect(page.getByText(/8 December|recording time left/)).toHaveCount(0);await assertPhone(page);
  await page.goto(base+'/terms');await expect(page.getByRole('heading',{name:'Instance terms and privacy'})).toBeVisible();await assertPhone(page);
  await page.goto(base+'/connect');await page.getByRole('button',{name:'Sign out everywhere'}).click();await page.getByRole('button',{name:'Confirm sign out'}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await assertPhone(page);
  now+=61000;await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('checkbox',{name:'I agree to the instance terms'}).check();await page.getByRole('button',{name:'Send sign-in code'}).click();await expect(page.getByLabel('Sign-in code')).toBeVisible();await page.getByLabel('Sign-in code').fill(codes.get(email)!);await page.getByRole('button',{name:'Sign in and open notebook'}).click();await expect(page.getByText('Your notebook starts here')).toBeVisible();
 }finally{await page.goto('about:blank');await app.locals.queue.stop();await new Promise<void>(r=>server.close(()=>r()));db.close()}
});
