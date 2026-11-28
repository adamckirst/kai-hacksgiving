import { test,expect } from './fixture';
import { assertPhone } from './usability';

test('Connect explains the shortcut at 375 px and copies an address without showing private data in test artifacts',async({page,kai})=> {
  // The layout uses an invalid, non-secret stand-in; real address access is checked by HTTP tests.
  const placeholder='/in/'+('layout-example-'.repeat(5));
  await page.route('**/api/connect',route=>route.fulfill({json:{uploadPath:placeholder,mcpPath:'/mcp/'+('layout-example-'.repeat(5))}}));
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('link',{name:'Connections',exact:true}).click();
  await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toBeEnabled();
  await expect(page.locator('ol[aria-label="Phone setup"] > li > h3')).toHaveText(['1. Copy your address','2. Add the iOS shortcut','3. Try it']);
  await expect(page.getByText('Show in Share Sheet',{exact:false})).toBeHidden();
  await expect(page.getByLabel('Your private address')).toBeHidden();await assertPhone(page);
  await page.locator('summary').filter({hasText:'Build it yourself'}).click();
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
  await page.locator('summary').filter({hasText:'Build it yourself'}).click();
  await expect(page.getByText('Show in Share Sheet',{exact:false})).toBeHidden();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Clipboard unavailable');}}}));
  await page.getByRole('button',{name:'Copy your address',exact:true}).click();
  await expect(page.getByText('Touch and hold the address to copy it.')).toBeVisible();
  await expect(page.getByLabel('Your private address')).toBeVisible();
  await assertPhone(page);
});

test('public Connect has no private address or setup controls',async({page})=> {
  await page.goto('/connect');await expect(page.getByText('Read-only demo')).toBeVisible();
  await expect(page.getByLabel('Your private address')).toHaveCount(0);await expect(page.getByLabel('Your assistant address')).toHaveCount(0);await expect(page.getByRole('button',{name:'Copy your address'})).toHaveCount(0);await assertPhone(page);
});


test('shortcut checkbox persists, reveals assistant setup and keeps sharing return available',async({page,kai})=>{
 await page.route('**/api/connect',async route=>{const r=await route.fetch();const data=await r.json();await route.fulfill({json:{...data,uploadPath:'/in/layout-example',mcpPath:'/mcp/layout-example'}})});
 await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'','/#judge='+value);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.goto('/connect?next=messages');
 const checkbox=page.getByRole('checkbox',{name:'I already have the shortcut set up'});
 await checkbox.click();await expect(checkbox).toBeChecked();await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toHaveCount(0);await assertPhone(page);
 await page.reload();await expect(checkbox).toBeChecked();
 for(const name of ['Claude','ChatGPT','Grok','Muse']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('region',{name:name+' setup'})).toBeVisible();await expect(page.getByRole('link',{name:name+'’s setup guide'})).toHaveAttribute('href',/^https:/);await assertPhone(page)}
 await expect(page.getByText('KAI’s connection to Muse has not been verified.',{exact:false})).toBeVisible();
 await checkbox.click();await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toBeVisible();await page.reload();await expect(checkbox).not.toBeChecked();
 await page.route('**/api/connect/shortcut',route=>route.fulfill({status:500,json:{error:'Invented failure'}}));await checkbox.click();await expect(page.getByText('Your setup could not be saved. Try again.')).toBeVisible();await expect(checkbox).not.toBeChecked();
 await page.getByRole('link',{name:'Back to upload'}).click();await expect(page.getByRole('heading',{name:'From Messages'})).toBeVisible();
});
