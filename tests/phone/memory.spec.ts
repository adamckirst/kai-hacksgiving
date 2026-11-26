import { test,expect } from './fixture';
import { assertPhone } from './usability';
test('Dana’s seeded page loses the overdue pricing only after accepting KAI’s kept-promise suggestion',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);await page.getByRole('link',{name:'Try it yourself'}).click();
  await page.goto('/people');await page.getByRole('link',{name:/Dana Whitfield/}).click();await expect(page.getByText('Send Dana the pricing',{exact:true})).toBeVisible();await assertPhone(page);
  await page.goto('/home');await page.getByRole('button',{name:'A follow-up with Dana',exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
  await expect(page.getByRole('heading',{name:'Mark “Send Dana the pricing” done'})).toBeVisible();await assertPhone(page);
  await page.getByRole('button',{name:/^Accept all/}).click();await expect(page.getByText('Accepted',{exact:true})).toHaveCount(4);
  await expect(page.getByRole('link',{name:'See people'})).toHaveCount(0);await assertPhone(page);await page.getByRole('link',{name:'Back to Home',exact:true}).click();await page.getByRole('link',{name:'People',exact:true}).click();await page.getByRole('link',{name:/Dana Whitfield/}).click();await expect(page.getByText('Send Dana the pricing',{exact:true})).toHaveCount(0);await expect(page.getByText('Send the security questionnaire',{exact:true})).toBeVisible();
});
