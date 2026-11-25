import { photograph } from './photos';
import { randomUUID } from 'node:crypto';
import { test,expect } from './fixture';
import { assertPhone } from './usability';

test('a read-only phone visitor can join once with a quiet button and keep browsing',async({page,kai})=> {
  const before=(kai.db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n;
  await page.goto('/home');await expect(page.getByRole('button',{name:'Keep me posted',exact:true})).toBeEnabled();
  await expect(page.getByText('Only for that one note; ask me and I delete it.')).toBeVisible();await assertPhone(page);
  await page.getByLabel('Email',{exact:true}).fill(randomUUID()+'@example.invalid');await page.getByRole('button',{name:'Keep me posted',exact:true}).click();
  await expect(page.getByText('You’re on the list. Thank you.')).toBeVisible();await expect(page.getByLabel('Email',{exact:true})).toHaveCount(0);await assertPhone(page);
  expect((kai.db.prepare('SELECT count(*) AS n FROM waitlist').get() as {n:number}).n).toBe(before+1);
  await page.getByRole('link',{name:'People',exact:true}).click();await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
});

test('the waitlist appears under suggestions only after they are decided',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();await page.getByRole('button',{name:'Meeting Sora',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();await expect(page.getByRole('heading',{name:'Would you use something like this?'})).toHaveCount(0);
  await page.getByRole('button',{name:/^Accept all/}).click();await expect(page.getByRole('heading',{name:'Would you use something like this?'})).toBeVisible();await assertPhone(page);
});

test('Copal’s private page shows only the count and one download action at 375 px',async({page,kai})=> {
  await page.goto('/operator');await expect(page.getByText('Open your private download link to see the list.')).toBeVisible();await assertPhone(page);
  await page.evaluate(value=>{history.replaceState(null,'',`/operator#download=${value}`);location.reload();},kai.downloadSecret);
  await expect(page.getByRole('button',{name:'Download addresses',exact:true})).toBeVisible();expect(await page.evaluate(()=>location.hash==='')).toBe(true);
  await expect(page.getByRole('heading',{name:'Your waitlist',exact:true})).toBeVisible();await assertPhone(page);await photograph(page,'operator');
});
