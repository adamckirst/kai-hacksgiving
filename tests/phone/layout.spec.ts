import { photograph } from './photos';
import { assertPhone } from './usability';
import { test,expect } from './fixture';
for(const kind of ['public','judge'] as const) {
  for(const route of ['/','/people','/home','/todos','/connect','/people/dana','/recordings/dana-call']) {
    test(`${kind} ${route}: U6–U8 at 375 px`,async({page,kai})=> {
      // Never put usable sharing or assistant addresses in screenshots or failure output.
      await page.route('**/api/connect',r=>r.fulfill({json:{uploadPath:'/in/layout-example',mcpPath:'/mcp/layout-example'}}));
      let prefix='';
      if(kind==='judge') {
        await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
        await expect(page.getByRole('link',{name:'Try it yourself'})).toBeVisible();
        prefix=(await page.context().cookies()).find(c=>c.name==='kai_session')!.value.split('.')[0]+':';
      }
      const actual=route==='/people/dana' ? '/people/'+prefix+'dana':route==='/recordings/dana-call' ? '/recordings/'+prefix+'dana-call':route;
      await page.goto(actual);
      if(route==='/')await expect(page.getByRole('link',{name:kind==='judge' ? 'Try it yourself':'Look around'})).toBeVisible();
      else if(kind==='public')await expect(page.getByText('A read-only demo with made-up data.')).toBeVisible();
      if(route==='/people') {
        await expect(page.getByRole('link',{name:/Dana Whitfield/})).toBeVisible();
        await expect(page.getByRole('region',{name:'Everyone else',exact:true}).locator('li')).toHaveCount(2);
        await expect(page.getByRole('region',{name:'Everyone else',exact:true})).not.toContainText('Dana Whitfield');
      }
      if(route==='/home')await expect(page.getByText('Send Dana the pricing',{exact:true})).toBeVisible();
      if(route==='/connect' && kind==='judge')await expect(page.getByRole('button',{name:'Copy your address',exact:true})).toBeEnabled();
      if(route==='/people/dana')await expect(page.getByRole('heading',{name:'Dana Whitfield',exact:true})).toBeVisible();
      if(route==='/recordings/dana-call')await expect(page.getByRole('heading',{name:'First call with Dana',exact:true})).toBeVisible();
      if(route==='/todos')await expect(page.getByText('Send Dana the pricing',{exact:true})).toBeVisible();
      await assertPhone(page);
      const name=route==='/' ? 'welcome':route==='/people/dana' ? 'person':route==='/recordings/dana-call' ? 'recording-seeded':route.slice(1);
      await photograph(page,name+(kind==='public' ? '-public':''));
    });
  }
}
