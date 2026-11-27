import { test,expect } from './fixture';
import { testTone } from '../../src/server/gateway';
import { assertPhone } from './usability';
test('phone adds a generated recording and reads its words',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
  await page.getByRole('link',{name:'Add recordings',exact:true}).click();
  await page.getByRole('button',{name:/^My memo/}).click();
  await page.getByLabel('Add recording: choose one audio file').setInputFiles({name:'invented.wav',mimeType:'audio/wav',buffer:testTone()});
  await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
  await expect(page.getByRole('region',{name:'The words',exact:true})).toContainText('Dana Whitfield');await assertPhone(page);
});
