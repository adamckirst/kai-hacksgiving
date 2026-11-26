import { test,expect } from './fixture';
import { assertPhone } from './usability';

test('Connect explains the shortcut at 375 px and copies an address without showing private data in test artifacts',async({page,kai})=> {
  // The layout uses an invalid, non-secret stand-in; real address access is checked by HTTP tests.
  const placeholder='/in/'+('layout-example-'.repeat(5));
  await page.route('**/api/connect',route=>route.fulfill({json:{uploadPath:placeholder,mcpPath:'/mcp/'+('layout-example-'.repeat(5))}}));
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();await page.getByRole('link',{name:'Connect',exact:true}).click();
  await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toBeEnabled();
  await expect(page.getByText('Show in Share Sheet',{exact:false})).toBeVisible();
  await expect(page.getByText('Get Contents of URL',{exact:false})).toBeVisible();await assertPhone(page);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value:string)=>{document.body.dataset.copied=value;}}}));
  await page.getByRole('button',{name:'Copy your address',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Copied.');
  expect(await page.evaluate(path=>document.body.dataset.copied===location.origin+path,placeholder)).toBe(true);
  await page.getByRole('button',{name:'Copy upload address',exact:true}).click();
  expect(await page.evaluate(()=>document.body.dataset.copied===location.origin+'/upload')).toBe(true);
  await page.getByRole('button',{name:'Copy assistant address',exact:true}).click();
  expect(await page.evaluate(()=>document.body.dataset.copied===location.origin+'/mcp/'+('layout-example-'.repeat(5)))).toBe(true);
  await expect(page.getByRole('status')).toBeVisible();
  const feedback=await page.getByRole('status').boundingBox(),button=await page.getByRole('button',{name:'Copy assistant address',exact:true}).boundingBox();
  expect(Math.abs(feedback!.y-button!.y)).toBeLessThan(100);
  await assertPhone(page);
});

test('public Connect has no private address or setup controls',async({page})=> {
  await page.goto('/connect');await expect(page.getByText('Read-only demo')).toBeVisible();
  await expect(page.getByLabel('Your private address')).toHaveCount(0);await expect(page.getByLabel('Your assistant address')).toHaveCount(0);await expect(page.getByRole('button',{name:'Copy your address'})).toHaveCount(0);await assertPhone(page);
});
