import {TERMS_VERSION} from '../../src/terms';
import {randomUUID} from 'node:crypto';
import {createJudge} from '../../src/server/access';
import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('email sign-in restores a recording in a second browser and offers explicit sign-out at 375 px',async({page,browser,kai})=>{
 const judge=createJudge(kai.db,false),email=randomUUID()+'@example.invalid',recording=randomUUID();
 kai.db.prepare('UPDATE workspaces SET trial_seconds=123,trial_verified=1 WHERE id=?').run(judge.id);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?)').run(email,'2026-11-27',judge.id,'2026-11-27',TERMS_VERSION,'2026-11-27');
 kai.db.prepare('INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,?,?,?,?,?,?)').run(recording,judge.id,'Dana’s next steps','Dana will send the dates.','paste','Dana will send the dates.','2026-11-27','ready');
 const original=await browser.newContext({viewport:{width:375,height:812}});await original.addCookies([{name:'kai_session',value:judge.cookie,url:'http://127.0.0.1:18520'}]);
 try{
  await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.190'});await page.goto('/recordings/'+recording);await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await assertPhone(page);
  await page.getByLabel('Email',{exact:true}).fill(email);await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByRole('button',{name:'Send verification code'}).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();await assertPhone(page);const code=kai.codes.get(email)!;const wrong=String((Number(code)+1)%1000000).padStart(6,'0');
  await page.getByLabel('Verification code').fill(wrong);await page.getByRole('button',{name:'Verify email'}).click();await expect(page.getByText('This code expired or could not be checked. Ask for a new code.')).toBeVisible();await assertPhone(page);
  await page.getByLabel('Verification code').fill(code);await page.getByRole('button',{name:'Verify email'}).click();await expect(page.getByRole('heading',{name:'Dana’s next steps',exact:true})).toBeVisible();await assertPhone(page);
  expect((kai.db.prepare('SELECT trial_seconds FROM workspaces WHERE id=?').get(judge.id) as {trial_seconds:number}).trial_seconds).toBe(123);
  await page.goto('/login');await expect(page.getByRole('heading',{name:'You’re already signed in'})).toBeVisible();await expect(page.getByRole('button',{name:'Switch notebooks'})).toBeEnabled();await assertPhone(page);
  await page.getByRole('link',{name:'Keep using this notebook'}).click();await page.getByRole('link',{name:'Connections',exact:true}).click();await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByText('Sign out of this browser?',{exact:true})).toBeVisible();await assertPhone(page);await page.getByRole('button',{name:'Confirm sign out'}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await assertPhone(page);
  const old=await original.newPage();await old.goto('/home');await expect(old.getByText('2 min 3 sec left')).toBeVisible();
 }finally{await original.close()}
});
test('Welcome uses the shared entry action and invitation switching warns before leaving',async({page,kai})=>{
 await page.goto('/');await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Send verification code'})).toBeEnabled();await assertPhone(page);
 const invitation=createJudge(kai.db,false);await page.context().addCookies([{name:'kai_session',value:invitation.cookie,url:'http://127.0.0.1:18520'}]);await page.goto('/login');
 await expect(page.getByText('This invitation notebook has no verified email. Signing out will lose this browser’s access.')).toBeVisible();await expect(page.getByRole('button',{name:'Switch notebooks'})).toBeDisabled();await page.getByRole('checkbox',{name:'I’m ready to leave this notebook'}).check();await expect(page.getByRole('button',{name:'Switch notebooks'})).toBeEnabled();await assertPhone(page);await page.getByRole('button',{name:'Switch notebooks'}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
});
