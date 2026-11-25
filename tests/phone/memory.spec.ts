import { test,expect } from './fixture';
import { assertPhone } from './usability';
test('Dana’s seeded page loses the overdue pricing only after accepting KAI’s kept-promise suggestion',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);await page.getByRole('link',{name:'Try it yourself'}).click();
  await page.goto('/people');await page.locator('.everyone').getByRole('link',{name:/Dana Whitfield/}).click();await expect(page.getByRole('heading',{name:'Send Dana the pricing',exact:true})).toBeVisible();await assertPhone(page);
  await page.goto('/home');await page.getByRole('button',{name:'A follow-up with Dana',exact:true}).click();await expect(page.getByText('KAI has finished reading.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Mark “Send Dana the pricing” done'})).toBeVisible();await assertPhone(page);
  await page.getByRole('button',{name:'Accept all',exact:true}).click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(4);
  await page.getByRole('link',{name:'See people'}).click();await page.locator('.everyone').getByRole('link',{name:/Dana Whitfield/}).click();await expect(page.getByRole('heading',{name:'Send Dana the pricing',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Send the security questionnaire',exact:true})).toBeVisible();
});
