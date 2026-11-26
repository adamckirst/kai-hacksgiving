import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('four notebook tabs, contextual setup and recording notifications work at 375 px',async({page,kai})=>{
 await page.route('**/api/connect',async route=>{const r=await route.fetch();const data=await r.json();await route.fulfill({json:{...data,uploadPath:'/in/layout-example',mcpPath:'/mcp/layout-example'}})});
 await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'Main'}).getByRole('link')).toHaveText(['Home','Library','People','Tasks']);
 await expect(page.getByRole('link',{name:'Set up your phone',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Connections',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Connections',exact:true})).toBeVisible();await expect(page.getByRole('navigation',{name:'Main'})).toHaveCount(0);
 await page.getByRole('button',{name:'I’ve added the shortcut',exact:true}).click();await expect(page.getByText('Your phone shortcut is set up.')).toBeVisible();
 await page.getByRole('link',{name:'Back to Home',exact:true}).click();await expect(page.getByRole('link',{name:'Set up your phone',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Library',exact:true}).click();await expect(page.getByRole('heading',{name:'Library',exact:true})).toBeVisible();await assertPhone(page);
 await page.getByRole('link',{name:/^Notifications/}).click();await expect(page.getByRole('heading',{name:'Notifications',exact:true})).toBeVisible();await assertPhone(page);
 const first=page.locator('main a[href^="/recordings/"]').first();const href=await first.getAttribute('href');await first.click();
 await expect.poll(async()=>{const r=await page.request.get('/api/notifications');const data=await r.json();return data.items.find((x:any)=>'/recordings/'+x.id===href)?.seen}).toBe(1);
});
