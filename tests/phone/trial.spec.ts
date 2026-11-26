import {randomUUID} from 'node:crypto';
import {createJudge} from '../../src/server/access';
import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('public trial joins the waitlist and opens an empty notebook at 375 px',async({page,kai})=>{
 await page.goto('/');await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Try KAI with your recordings'})).toBeVisible();await assertPhone(page);
 await page.getByLabel('Email',{exact:true}).fill(randomUUID()+'@example.invalid');
 await page.getByRole('button',{name:'Join and try KAI'}).click();
 await expect(page).toHaveURL(/\/home$/);await expect(page.getByText('Your notebook starts here')).toBeVisible();
 await expect(page.getByText('60 min 0 sec of recording time left')).toBeVisible();await assertPhone(page);
 await expect(page.getByText('Send Dana the pricing')).toHaveCount(0);
 const cookie=(await page.context().cookies()).find(c=>c.name==='kai_session')!;
 kai.db.prepare('UPDATE workspaces SET trial_seconds=0 WHERE id=?').run(cookie.value.split('.')[0]);
 await page.reload();await expect(page.getByText(/You’ve used your hour/)).toBeVisible();await assertPhone(page);
});
test('a trial claimed in another browser shows a useful error without giving access',async({page,kai})=>{
 const email=randomUUID()+'@example.invalid';
 const judge=createJudge(kai.db,false);
 kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id) VALUES (?,?,?)').run(email,new Date().toISOString(),judge.id);
 await page.goto('/try');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('button',{name:'Join and try KAI'}).click();
 await expect(page.getByText('This trial cannot be opened here. Use the browser where you started it.')).toBeVisible();await assertPhone(page);
 expect((await page.context().cookies()).some(c=>c.name==='kai_session')).toBe(false);
});
