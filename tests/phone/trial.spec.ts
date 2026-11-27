import {randomUUID} from 'node:crypto';
import {createJudge} from '../../src/server/access';
import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('public trial joins the waitlist and opens an empty notebook at 375 px',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.101'});
 await page.goto('/');await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Try KAI with your recordings'})).toBeVisible();await assertPhone(page);
 const email=randomUUID()+'@example.invalid';await page.getByLabel('Email',{exact:true}).fill(email);
 await expect(page.getByRole('button',{name:'Send verification code'})).toBeDisabled();await page.getByRole('checkbox',{name:'I agree to the demo terms'}).check();await page.getByRole('button',{name:'Send verification code'}).click();
 await expect(page.getByLabel('Verification code')).toBeVisible();await assertPhone(page);
 await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify and open notebook'}).click();
 await expect(page).toHaveURL(/\/home$/);await expect(page.getByText('Your notebook starts here')).toBeVisible();
 await expect(page.getByText('30 min 0 sec left')).toBeVisible();await assertPhone(page);
 await expect(page.getByText('Send Dana the pricing')).toHaveCount(0);
 const cookie=(await page.context().cookies()).find(c=>c.name==='kai_session')!;
 kai.db.prepare('UPDATE workspaces SET trial_seconds=0 WHERE id=?').run(cookie.value.split('.')[0]);
 await page.reload();await expect(page.getByText(/You’ve used your 30 minutes/)).toBeVisible();await assertPhone(page);
});
test('a trial claimed in another browser shows a useful error without giving access',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.102'});
 const email=randomUUID()+'@example.invalid';
 const judge=createJudge(kai.db,false);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id) VALUES (?,?,?)').run(email,new Date().toISOString(),judge.id);
 await page.goto('/try');await page.getByLabel('Email',{exact:true}).fill(email);await expect(page.getByRole('button',{name:'Send verification code'})).toBeDisabled();await page.getByRole('checkbox',{name:'I agree to the demo terms'}).check();await page.getByRole('button',{name:'Send verification code'}).click();
 await expect(page.getByLabel('Verification code')).toBeVisible();await assertPhone(page);
 await page.getByLabel('Verification code').fill(kai.codes.get(email)!);await page.getByRole('button',{name:'Verify and open notebook'}).click();
 await expect(page.getByText('Return to the browser where you started this notebook to verify it.')).toBeVisible();await assertPhone(page);
 expect((await page.context().cookies()).some(c=>c.name==='kai_session')).toBe(false);
});

test('Home card reuses its email, requires popup consent and verifies into the same trial flow',async({page,kai})=>{
 await page.setExtraHTTPHeaders({'Sprite-Client-IP':'192.0.2.181'});
 await page.goto('/home');
 const floating=page.getByRole('link',{name:'Try it yourself',exact:true});await expect(floating).toBeVisible();
 const email=randomUUID()+'@example.invalid';await page.getByLabel('Email',{exact:true}).fill(email);
 const action=page.getByRole('button',{name:'Try it myself',exact:true});await action.scrollIntoViewIfNeeded();await expect(floating).toHaveCount(0);await assertPhone(page);
 await action.click();const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Try KAI with your recordings'})).toBeVisible();await expect(dialog.getByLabel('Email',{exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Send verification code'})).toBeDisabled();expect(kai.codes.has(email)).toBe(false);await assertPhone(page);
 await dialog.getByRole('button',{name:'Back to browsing'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByLabel('Email',{exact:true})).toHaveValue(email);
 await page.evaluate(()=>scrollTo(0,0));await expect(floating).toBeVisible();
 await action.click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Send verification code'}).click();await expect(dialog.getByLabel('Verification code')).toBeVisible();await assertPhone(page);
 await dialog.getByLabel('Verification code').fill(kai.codes.get(email)!);await dialog.getByRole('button',{name:'Verify and open notebook'}).click();
 await expect(page.getByText('Your notebook starts here')).toBeVisible();await expect(page.getByText('30 min 0 sec left')).toBeVisible();
});
