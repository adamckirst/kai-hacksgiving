import { test,expect } from './fixture';
import { assertPhone } from './usability';
import { samples } from '../../src/samples';
for(const sample of samples) test(`${sample.id}: sample to suggestions, quote highlight, U6–U8`,async({page,kai})=> {
  await page.goto('/');
  await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
  await expect(page.getByRole('heading',{name:'Paste a transcript'})).toBeVisible();
  await assertPhone(page);
  await page.getByRole('button',{name:sample.title,exact:true}).click();
  await expect(page.getByText('KAI has finished reading.')).toBeVisible();
  await expect(page.locator('.quote-button')).toHaveCount(sample.id==='dana' ? 4:3);
  await assertPhone(page);
  const quote=await page.locator('.quote-button').first().textContent();
  await page.locator('.quote-button').first().click();
  await expect(page.locator('mark')).toHaveText(quote!);
  await expect(page.locator('mark')).toBeInViewport();
});
