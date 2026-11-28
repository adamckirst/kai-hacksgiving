import {TERMS_VERSION} from '../../src/terms';
import {randomUUID} from 'node:crypto';
import {createJudge} from '../../src/server/access';
import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('public trial joins the waitlist and opens an empty notebook at 375 px',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.101'});
 await page.goto('/');await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Try KAI with your recordings'})).toBeVisible();await assertPhone(page);
 const email=randomUUID()+'@example.invalid';await page.getByLabel('Email',{exact:true}).fill(email);
 await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByRole('button',{name:'Send verification code'}).click();
 await expect(page.getByLabel('Verification code')).toBeVisible();await assertPhone(page);
 await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify email'}).click();
 await expect(page.getByRole('checkbox')).toBeVisible();await expect(page.getByRole('button',{name:'Agree and open notebook'})).toBeDisabled();await assertPhone(page);
 expect(kai.db.prepare('SELECT 1 FROM waitlist WHERE email=?').get(email)).toBeUndefined();
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Agree and open notebook'}).click();
 await expect(page).toHaveURL(/\/connect\?next=onboarding$/);await expect(page.getByRole('heading',{name:'Set up your shortcut'})).toBeVisible();await page.getByRole('link',{name:'Back to Home'}).click();
 await expect(page.getByText('30 min 0 sec left')).toBeVisible();await assertPhone(page);
 await expect(page.getByText('Send Dana the pricing')).toHaveCount(0);
 const owner=kai.db.prepare('SELECT workspace_id FROM waitlist WHERE email=?').get(email) as {workspace_id:string};
 kai.db.prepare('UPDATE workspaces SET trial_seconds=0 WHERE id=?').run(owner.workspace_id);
 await page.reload();await expect(page.getByText(/You’ve used your 30 minutes/)).toBeVisible();await assertPhone(page);
});
test('a trial claimed in another browser shows a useful error without giving access',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.102'});
 const email=randomUUID()+'@example.invalid';
 const judge=createJudge(kai.db,false);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id) VALUES (?,?,?)').run(email,new Date().toISOString(),judge.id);
 await page.goto('/try');await page.getByLabel('Email',{exact:true}).fill(email);await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByRole('button',{name:'Send verification code'}).click();
 await expect(page.getByLabel('Verification code')).toBeVisible();await assertPhone(page);
 await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify email'}).click();
 await expect(page.getByText('Return to the browser where you started this notebook to verify it.')).toBeVisible();await assertPhone(page);
 expect((await page.context().cookies()).some(c=>c.name==='kai_session')).toBe(false);
});

test('Home card verifies first, cancels without a grant, and preserves input and scrolling handoff',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.181'});await page.goto('/home');
 const floating=page.getByRole('link',{name:'Try it yourself',exact:true});await expect(floating).toBeVisible();
 const email=randomUUID()+'@example.invalid';await page.getByLabel('Email',{exact:true}).fill(email);
 const action=page.getByRole('button',{name:'Try it myself',exact:true});await action.scrollIntoViewIfNeeded();await expect(floating).toHaveCount(0);await assertPhone(page);
 await action.click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Check your email'})).toBeVisible();await expect(dialog.getByLabel('Email',{exact:true})).toHaveCount(0);await expect(dialog.getByRole('checkbox')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Verify email'})).toBeEnabled();await assertPhone(page);
 await dialog.getByLabel('Verification code').fill(kai.codes.get(email)!);await dialog.getByRole('button',{name:'Verify email'}).click();
 await expect(dialog.getByRole('checkbox')).toBeVisible();await expect(dialog.getByRole('button',{name:'Agree and open notebook'})).toBeDisabled();await assertPhone(page);
 expect(kai.db.prepare('SELECT 1 FROM waitlist WHERE email=?').get(email)).toBeUndefined();
 await dialog.getByRole('button',{name:'Back to browsing'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Email',{exact:true})).toHaveValue(email);
 expect(kai.db.prepare('SELECT 1 FROM entry_challenges WHERE email=?').get(email)).toBeUndefined();
 await page.evaluate(()=>scrollTo(0,0));await expect(floating).toBeVisible();
 const next=randomUUID()+'@example.invalid';await page.getByLabel('Email',{exact:true}).fill(next);await action.click();await expect(dialog.getByRole('button',{name:'Verify email'})).toBeEnabled();
 await dialog.getByLabel('Verification code').fill(kai.codes.get(next)!);await dialog.getByRole('button',{name:'Verify email'}).click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Agree and open notebook'}).click();
 await expect(page.getByRole('heading',{name:'Set up your shortcut'})).toBeVisible();await page.getByRole('link',{name:'Back to Home'}).click();await expect(page.getByText('30 min 0 sec left')).toBeVisible();
});

test('Home card reopens a returning notebook without terms or changes to its recordings and time',async({page,kai})=>{
 const owner=createJudge(kai.db,false),email=randomUUID()+'@example.invalid';
 kai.db.prepare('UPDATE workspaces SET trial_seconds=123,trial_verified=1 WHERE id=?').run(owner.id);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?)').run(email,'2026-11-27',owner.id,'2026-11-27',TERMS_VERSION,'2026-11-27');
 kai.db.prepare('INSERT INTO conversations(id,workspace_id,title,summary,source,text,happened_on,status) VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),owner.id,'Dana’s next steps','Dana will send dates.','paste','Dana will send dates.','2026-11-27','ready');
 const before=kai.db.prepare('SELECT * FROM waitlist WHERE email=?').get(email);
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.182'});await page.goto('/home');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Try it myself',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Verify email'})).toBeEnabled();await expect(dialog.getByRole('checkbox')).toHaveCount(0);
 await dialog.getByLabel('Verification code').fill(kai.codes.get(email)!);await dialog.getByRole('button',{name:'Verify email'}).click();await expect(page.getByText('2 min 3 sec left')).toBeVisible();await expect(page.getByText('Dana’s next steps')).toBeVisible();expect(kai.db.prepare('SELECT * FROM waitlist WHERE email=?').get(email)).toEqual(before);await assertPhone(page);
});

test('a returning owner explicitly agrees to updated terms only after email proof',async({page,kai})=>{
 const owner=createJudge(kai.db,false),email=randomUUID()+'@example.invalid';kai.db.prepare('UPDATE workspaces SET trial_seconds=123,trial_verified=1 WHERE id=?').run(owner.id);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,terms_version) VALUES (?,?,?,?,?)').run(email,'2026-11-27',owner.id,'2026-11-27','older-version');
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.183'});await page.goto('/login');await expect(page.getByRole('checkbox')).toHaveCount(0);await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Send verification code'}).click();await expect(page.getByRole('button',{name:'Verify email'})).toBeEnabled();
 await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify email'}).click();await expect(page.getByRole('heading',{name:'Review updated terms'})).toBeVisible();await expect(page.getByRole('button',{name:'Agree and open notebook'})).toBeDisabled();await assertPhone(page);
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Agree and open notebook'}).click();await expect(page.getByText('2 min 3 sec left')).toBeVisible();
});

test('public trial action yields at the lower viewport edge on phone and desktop',async({page})=>{
 for(const width of [375,1280]){
  await page.setViewportSize({width,height:812});await page.goto('/home');
  const floating=page.getByRole('link',{name:'Try it yourself',exact:true});await expect(floating).toBeVisible();
  const card=page.getByRole('button',{name:'Try it myself',exact:true});await expect(card).toBeEnabled();
  await card.evaluate(el=>el.scrollIntoView({block:'end'}));await expect(floating).toHaveCount(0);await assertPhone(page);
  await page.evaluate(()=>scrollTo(0,0));await expect(floating).toBeVisible();await assertPhone(page);
 }
});
