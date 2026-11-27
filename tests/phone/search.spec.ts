import {test,expect} from './fixture';
import {assertPhone} from './usability';
async function search(page:import('@playwright/test').Page,q:string){await page.getByLabel('Search your notebook').fill(q);await page.getByRole('button',{name:'Search',exact:true}).click();}
test('search sits right of the main action and finds all three kinds; task results open the exact task',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 const action=await page.getByRole('link',{name:'Add recordings',exact:true}).boundingBox(),find=await page.getByRole('link',{name:'Search',exact:true}).boundingBox();expect(find!.x).toBeGreaterThan(action!.x+action!.width-1);await assertPhone(page);
 await page.getByRole('link',{name:'Search',exact:true}).click();await expect(page.getByLabel('Search your notebook')).toBeFocused();await expect(page.getByText('Find tasks, recordings by title or words, and people by details or notes.',{exact:true})).toBeVisible();await assertPhone(page);await search(page,'Dana');
 for(const name of ['Library','People','Tasks'])await expect(page.getByRole('region',{name,exact:true})).toBeVisible();await assertPhone(page);
 await page.getByRole('region',{name:'People',exact:true}).getByRole('link').click();await expect(page.getByRole('heading',{name:'Dana Whitfield',exact:true})).toBeVisible();await page.goBack();
 await expect(page.getByLabel('Search your notebook')).toHaveValue('Dana');
 await page.getByRole('region',{name:'Tasks',exact:true}).getByRole('link',{name:/Send Dana the pricing/}).click();
 await expect(page.getByRole('heading',{name:'Send Dana the pricing',exact:true})).toBeVisible();await assertPhone(page);
 await page.getByRole('button',{name:'Mark done',exact:true}).click();await expect(page.getByText('Done',{exact:true})).toBeVisible();await assertPhone(page);
 await page.getByRole('link',{name:'Back to Search',exact:true}).click();await expect(page.getByRole('region',{name:'Tasks',exact:true})).toContainText('Done');
 await page.getByRole('region',{name:'Library',exact:true}).getByRole('link').first().click();await expect(page.getByRole('region',{name:'The words',exact:true})).toBeVisible();
});
test('search handles no matches, failure and retry, and clears results when the query changes',async({page})=>{
 await page.goto('/search');await search(page,'nothingmatchesinvented');await expect(page.getByText(/No matches/)).toBeVisible();await assertPhone(page);
 await page.route('**/api/search?*',route=>route.fulfill({status:503,json:{error:'Invented failure'}}));await search(page,'Dana');await expect(page.getByRole('alert')).toHaveText('Search could not finish. Try again.');await assertPhone(page);
 await page.unroute('**/api/search?*');await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByRole('region',{name:'People',exact:true})).toContainText('Dana Whitfield');
 await page.getByLabel('Search your notebook').fill('Ellis');await expect(page.getByRole('region',{name:'People',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Search',exact:true}).click();await expect(page.getByRole('region',{name:'People',exact:true})).toContainText('Ellis Rowan');
});
test('public search stays read-only, including task details',async({page})=>{
 await page.goto('/home');await page.getByRole('link',{name:'Search',exact:true}).click();await search(page,'pricing');await assertPhone(page);
 await page.getByRole('region',{name:'Tasks',exact:true}).getByRole('link').click();await expect(page.getByText('Read-only demo',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Mark done',exact:true})).toHaveCount(0);await assertPhone(page);
});


test('a touch opens and focuses Search within the same tap; browser back and forward restore routes',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:18520',viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await page.goto('/people');await expect(page.getByRole('link',{name:'Search',exact:true})).toBeVisible();
  // The window bubble listener runs after the app's document listener, before the tap ends.
  await page.evaluate(()=>{
   document.documentElement.dataset.originalDocument='yes';
   window.addEventListener('click',event=>{
    if(event.target instanceof Element && event.target.closest('a')?.getAttribute('href')==='/search')document.documentElement.dataset.focusDuringTap=String(document.activeElement?.id==='search-query');
   });
  });
  let accessRequests=0;await page.route('**/api/access',route=>{accessRequests++;return route.continue()});
  await page.getByRole('link',{name:'Search',exact:true}).tap();await expect(page).toHaveURL(/\/search$/);
  await expect(page.locator('html')).toHaveAttribute('data-original-document','yes');await expect(page.locator('html')).toHaveAttribute('data-focus-during-tap','true');await expect(page.getByLabel('Search your notebook')).toBeFocused();expect(accessRequests).toBe(0);
  await search(page,'Dana');await expect(page.getByRole('region',{name:'People',exact:true})).toContainText('Dana Whitfield');
  await page.goBack();await expect(page).toHaveURL(/\/people$/);await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible();
  await page.goForward();await expect(page).toHaveURL(/\/search\?q=Dana$/);await expect(page.getByLabel('Search your notebook')).toHaveValue('Dana');await expect(page.getByRole('region',{name:'People',exact:true})).toContainText('Dana Whitfield');await assertPhone(page);
 }finally{await context.close()}
});
