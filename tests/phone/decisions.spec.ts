import { photograph } from './photos';
import { test,expect } from './fixture';
import { assertPhone } from './usability';
import type { Page } from '@playwright/test';
async function sample(page:Page,secret:string,title='Meeting Sora') {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();await page.getByRole('button',{name:title,exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
}
test('U4: one tap accepts all; People and Person pass U6–U8',async({page,kai})=> {
  await sample(page,kai.secret);const recordingId=decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!);kai.db.prepare("UPDATE conversations SET source='recording',batch_id='invented-batch' WHERE id=?").run(recordingId);await page.getByRole('button',{name:/^Accept all/}).click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(3);await expect(page.getByRole('status')).toHaveText('All suggestions accepted');expect((await (await page.request.get('/api/queue')).json()).some((r:{id:string})=>r.id===recordingId)).toBe(false);
  await expect(page.getByRole('link',{name:'See people'})).toHaveCount(0);await assertPhone(page);await page.getByRole('link',{name:'Back to Home',exact:true}).click();await page.getByRole('link',{name:'People',exact:true}).click();await expect(page.getByRole('main')).toContainText('Sora Bell');await assertPhone(page);
  await page.getByRole('link',{name:/Sora Bell/}).click();await expect(page.getByRole('heading',{name:'Sora Bell',exact:true})).toBeVisible();await expect(page.getByText('Send Sora a short overview',{exact:true})).toBeVisible();await assertPhone(page);
});
test('U4: one tap accepts one suggestion and one tap rejects a person and their pending items',async({page,kai})=> {
  await sample(page,kai.secret,'A follow-up with Dana');await page.getByRole('button',{name:'Accept',exact:true}).first().click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(1);
  await page.goto('/home');await page.getByRole('button',{name:'Meeting Sora',exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
  await page.getByRole('button',{name:'Reject',exact:true}).first().click();await expect(page.getByText('Rejected',{exact:true})).toHaveCount(3);
});
test('edit and accept preserves the quote and uses one violet action',async({page,kai})=> {
  await sample(page,kai.secret);await page.getByRole('button',{name:'Edit',exact:true}).last().click();
  await page.getByLabel('Words to keep').fill('Send Sora the short overview');await assertPhone(page);await photograph(page,'recording-editing');
  await page.getByRole('button',{name:'Save and accept',exact:true}).click();await expect(page.getByRole('heading',{name:'Send Sora the short overview',exact:true})).toBeVisible();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(2);
});
test('accepted changes through real routes stay private to one judge browser',async({browser,kai})=> {
  const first=await browser.newContext({viewport:{width:375,height:812}}),second=await browser.newContext({viewport:{width:375,height:812}});
  try {
    const a=await first.newPage(),b=await second.newPage();
    await sample(a,kai.secret);await sample(b,kai.secret,'A follow-up with Dana');
    const recording=new URL(a.url()).pathname.split('/').pop();
    expect((await b.request.get('/api/readings/'+recording)).status()).toBe(404);
    await a.getByRole('button',{name:/^Accept all/}).click();await expect(a.getByText('Accepted',{exact:true})).toHaveCount(3);
    await a.goto('/people');await b.goto('/people');
    await expect(a.getByRole('main')).toContainText('Sora Bell');await expect(b.getByRole('main')).not.toContainText('Sora Bell');
  }finally{await first.close();await second.close();}
});

test('a delayed poll cannot put an accepted suggestion back on screen',async({page,kai})=> {
  await sample(page,kai.secret);
  let delayed!:()=>void,release!:()=>void;
  const arrived=new Promise<void>(resolve=>delayed=resolve),released=new Promise<void>(resolve=>release=resolve);
  let held=false;
  await page.route('**/api/readings/*',async route=> {
    if(route.request().method()!=='GET' || held){await route.continue();return;}
    held=true;const response=await route.fetch();const old=await response.json();delayed();await released;await route.fulfill({json:old});
  });
  await arrived;
  await page.getByRole('button',{name:/^Accept all/}).click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(3);
  const delivered=page.waitForResponse(async response=>response.request().method()==='GET' && response.url().includes('/api/readings/') && (await response.json()).suggestions?.some((s:{status:string})=>s.status==='proposed'));
  release();await (await delivered).finished();await page.unrouteAll({behavior:'wait'});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  await expect(page.getByText('Accepted',{exact:true})).toHaveCount(3);await expect(page.getByRole('button',{name:/^Accept all/})).toHaveCount(0);
});
