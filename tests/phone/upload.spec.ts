import { test,expect } from './fixture';
import { testTone } from '../../src/server/gateway';
import { assertPhone } from './usability';
test('phone adds a generated recording and reads its words',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
  await page.getByLabel('Choose up to five audio files').setInputFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
  await page.getByRole('button',{name:'Add recordings',exact:true}).click();
  await expect(page.getByText('KAI has finished reading.')).toBeVisible();
  await expect(page.locator('.transcript')).toContainText('Dana Whitfield');await assertPhone(page);
});
