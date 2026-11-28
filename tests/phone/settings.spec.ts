import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {createJudge} from '../../src/server/access';
import {TERMS_VERSION} from '../../src/terms';
test('Settings scopes the account, differentiates sign-out buttons and confirms deletion at phone and desktop sizes',async({page,kai})=>{
 const owner=createJudge(kai.db,true),email='mara-settings@example.invalid';kai.db.prepare('UPDATE workspaces SET trial_verified=1,trial_seconds=123 WHERE id=?').run(owner.id);kai.db.prepare('INSERT INTO waitlist(email,created_at,workspace_id,verified_at,terms_version,terms_accepted_at) VALUES (?,?,?,?,?,?)').run(email,'2026-11-27',owner.id,'2026-11-27',TERMS_VERSION,'2026-11-27');
 await page.context().addCookies([{name:'kai_session',value:owner.cookie,url:'http://127.0.0.1:18520'}]);
 for(const width of [375,1280]){
  await page.setViewportSize({width,height:900});await page.goto('/settings');await expect(page.getByText(email,{exact:true})).toBeVisible();await expect(page.getByText('Email verified',{exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Sign in',exact:true})).toHaveCount(0);
  expect(await page.getByRole('button',{name:'Sign out',exact:true}).evaluate(e=>getComputedStyle(e).boxShadow)).not.toBe('none');expect(await page.getByRole('button',{name:'Sign out everywhere',exact:true}).evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none');await assertPhone(page);
  await page.getByRole('button',{name:'Delete my account',exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:'Delete your account?',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toContainText('This can’t be undone.');await assertPhone(page);await page.getByRole('button',{name:'Keep my account'}).click();expect(kai.db.prepare('SELECT 1 FROM workspaces WHERE id=?').get(owner.id)).toBeTruthy();
 }
 await page.getByRole('button',{name:'Delete my account',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete my account',exact:true}).click();await expect(page).toHaveURL('/');expect(kai.db.prepare('SELECT 1 FROM workspaces WHERE id=?').get(owner.id)).toBeUndefined();await page.goto('/settings');await expect(page.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();await expect(page.getByText(email,{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Delete my account',exact:true})).toHaveCount(0);await assertPhone(page);
});
