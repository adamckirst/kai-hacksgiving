import { test, expect } from './fixture';
import type { Page } from '@playwright/test';
async function openJudge(page:Page, secret:string) {
  await page.goto('/');
  await page.evaluate(value => {history.replaceState(null,'',`/#judge=${value}`);location.reload();},secret);
  await expect(page.getByRole('link',{name:'Try it yourself'})).toBeVisible();
}
test('U1: judge Welcome opens a populated Home in one tap; two browsers stay separate',async ({browser,kai}) => {
  const first = await browser.newContext({viewport:{width:375,height:812}}), second = await browser.newContext({viewport:{width:375,height:812}});
  try {
    const a=await first.newPage(),b=await second.newPage();
    await openJudge(a,kai.secret); await openJudge(b,kai.secret);
    expect(await a.evaluate(() => location.hash)).toBe('');
    const before = kai.db.prepare("SELECT id FROM workspaces WHERE kind='judge'").all() as {id:string}[];
    expect(before.length).toBe(2);
    await a.getByRole('link',{name:'Try it yourself'}).click();
    await expect(a.getByRole('link',{name:'3 people',exact:true})).toBeVisible();
    await expect(a.getByText('Send Dana the pricing')).toBeVisible();
    await expect(a.getByRole('link',{name:/First call with Dana/})).toBeVisible();
    await expect(a.getByText('Read-only demo')).toHaveCount(0);
    const cookie=(await first.cookies()).find(c=>c.name==='kai_session')!;
    expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Strict');
    const id=cookie.value.split('.')[0];
    kai.db.prepare("UPDATE people SET name='Dana Vale' WHERE workspace_id=? AND name='Dana Whitfield'").run(id);
    await a.goto('/people');await b.goto('/people');
    await expect(a.getByRole('link',{name:/Dana Vale/}).first()).toBeVisible();
    await expect(b.getByRole('link',{name:/Dana Whitfield/}).first()).toBeVisible();
    await expect(b.getByRole('link',{name:/Dana Vale/})).toHaveCount(0);
    await openJudge(a,kai.secret);
    expect((kai.db.prepare("SELECT count(*) AS n FROM workspaces WHERE kind='judge'").get() as {n:number}).n).toBe(2);
  } finally {await first.close();await second.close();}
});
test('public Welcome has Look around and no video until VIDEO_URL is set',async ({page}) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(process.env.VIDEO_URL ? 1 : 0);
  await page.getByRole('link',{name:'Look around'}).click();
  await expect(page.getByText('Read-only demo')).toBeVisible();
  await expect(page.getByText('Send Dana the pricing')).toBeVisible();
});
