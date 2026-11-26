import { test,expect } from './fixture';
import { assertPhone } from './usability';
import { testTone } from '../../src/server/gateway';
for(const route of ['/people','/todos','/people/dana']) {
  test(`${route} opens person choice before the file picker`,async({page,kai})=> {
    await page.goto('/');await page.evaluate(secret=>{history.replaceState(null,'',`/#judge=${secret}`);location.reload();},kai.secret);
    await page.getByRole('link',{name:'Try it yourself'}).click();
    const workspace=(await page.context().cookies()).find(c=>c.name==='kai_session')!.value.split('.')[0];
    await page.goto(route==='/people/dana' ? '/people/'+workspace+':dana':route);
    await page.getByRole('link',{name:'Add recordings',exact:true}).click();
    await page.getByRole('button',{name:/^Voice note from someone else/}).click();await expect(page.getByLabel('Who is speaking?')).toBeVisible();
    await page.getByRole('button',{name:/^Voice note from someone else/}).click();await page.getByLabel('Who is speaking?').selectOption(workspace+':dana');
    const chooser=page.waitForEvent('filechooser');
    await page.getByLabel('Add recordings: choose up to five audio files').click();
    await (await chooser).setFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
    await expect(page).toHaveURL(/\/recordings\//);
    await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
    await expect(page.getByRole('link',{name:'Dana Whitfield',exact:true})).toBeVisible();
    await assertPhone(page);
  });
}

test('paste errors stay visible and a retry can read the words',async({page,kai})=> {
  await page.goto('/');await page.evaluate(secret=>{history.replaceState(null,'',`/#judge=${secret}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
  await page.getByRole('button',{name:'Paste a transcript',exact:true}).click();
  await page.getByLabel('The words from your conversation').fill('Mara will review the invented clinic notes.');
  await page.route('**/api/readings',route=>route.fulfill({status:400,json:{error:'KAI could not start. Try again.'}}));
  await page.getByRole('button',{name:'Let KAI read',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('KAI could not start. Try again.');await assertPhone(page);
  await page.unroute('**/api/readings');await page.getByRole('button',{name:'Let KAI read',exact:true}).click();
  await expect(page.getByText('KAI found no suggestions in these words.')).toBeVisible();
  await expect(page.getByRole('region',{name:'The words',exact:true})).toContainText('Mara will review the invented clinic notes.');await assertPhone(page);
});

test('an edit failure is inside the sheet and cancellation keeps the proposal',async({page,kai})=> {
  await page.goto('/');await page.evaluate(secret=>{history.replaceState(null,'',`/#judge=${secret}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();await page.getByRole('button',{name:'Meeting Sora',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
  await page.getByRole('button',{name:'Edit',exact:true}).last().click();
  await page.getByLabel('Words to keep').fill('Changed words');
  await page.route('**/api/suggestions/*/decision',route=>route.fulfill({status:400,json:{error:'Check the words and use a real date.'}}));
  await page.getByRole('button',{name:'Save and accept',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Check the words and use a real date.');await assertPhone(page);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Send Sora a short overview',exact:true})).toBeVisible();
  await expect(page.getByText('Accepted',{exact:true})).toHaveCount(0);
});
