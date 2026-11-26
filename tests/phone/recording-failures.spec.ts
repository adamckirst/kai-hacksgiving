import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('Home distinguishes separate unfinished uploads and links each exactly once',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 await page.route('**/api/queue',route=>route.fulfill({json:[
  {id:'invented-pending',title:'New recording',status:'waiting',error:null,awaiting_person:1,reserved_seconds:27,happened_on:'2026-11-26'},
  {id:'invented-failed',title:'New recording',status:'failed',error:'KAI could not listen to this recording. Try again.',recording_type:'multiple',reserved_seconds:64,happened_on:'2026-11-26'},
  {id:'invented-speakers',title:'New recording',status:'waiting',error:null,awaiting_speakers:1,recording_type:'multiple',reserved_seconds:42,happened_on:'2026-11-26'}
 ]}));
 await page.evaluate(()=>sessionStorage.setItem('kai-upload-invented-pending','seen'));
 await page.goto('/home');
 await expect(page.locator('a[href="/upload/invented-pending"]')).toHaveCount(1);
 await expect(page.locator('a[href="/recordings/invented-failed"]')).toHaveCount(1);
 await expect(page.getByText('Choose the recording type to start',{exact:true})).toBeVisible();
 await expect(page.getByText('Identify speakers to continue',{exact:true})).toBeVisible();
 await expect(page.getByText('0 min 27 sec · 2026-11-26',{exact:true})).toBeVisible();
 await expect(page.getByText('1 min 4 sec · 2026-11-26',{exact:true})).toBeVisible();await assertPhone(page);
});
