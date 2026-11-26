import {test,expect} from './fixture';
import {assertPhone} from './usability';

test('suggestions appear before the summary, name affected people and keep pending actions first',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'A follow-up with Dana',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
 await expect(page.getByText('Note about Dana Whitfield',{exact:true})).toBeVisible();
 await expect(page.getByText('About Dana Whitfield',{exact:true})).toBeVisible();
 await expect(page.getByText('On Dana Whitfield’s page',{exact:true})).toBeVisible();
 await expect(page.getByText(/Dana Whitfield owes you/)).toBeVisible();
 const note=await page.getByText('Note about Dana Whitfield',{exact:true}).boundingBox();const summary=await page.getByText('KAI’s summary',{exact:true}).boundingBox();expect(note!.y).toBeLessThan(summary!.y);
 await page.getByRole('button',{name:'Accept',exact:true}).first().click();
 await expect(page.getByText('Accepted',{exact:true})).toHaveCount(1);
 const first=page.locator('main li').first();await expect(first).toContainText('Note about Dana Whitfield');await expect(first.getByRole('button',{name:'Accept',exact:true})).toBeEnabled();
 await expect(page.getByRole('heading',{name:'Mark “Send Dana the pricing” done',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^Show in the words:/}).first().click();await expect(page.locator('mark')).toBeVisible();await assertPhone(page);
});

test('suggestions about a proposed person show their name before and after accepting them',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Meeting Sora',exact:true}).click();
 await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
 await expect(page.getByText('Note about Sora Bell',{exact:true})).toBeVisible();await expect(page.getByText('About Sora Bell',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Accept',exact:true}).first().click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(1);
 await expect(page.getByText('Note about Sora Bell',{exact:true})).toBeVisible();await assertPhone(page);
});
