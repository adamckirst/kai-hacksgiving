import {test,expect} from './fixture';
import {assertPhone} from './usability';
test('Home hides passive notices; processing info supports tap and Escape; Upload and terms carry the privacy notice',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);await page.getByRole('link',{name:'Try it yourself',exact:true}).click();
 const cookie=(await page.context().cookies()).find(c=>c.name==='kai_session')!;kai.db.prepare('UPDATE workspaces SET trial_seconds=1556,trial_verified=1 WHERE id=?').run(cookie.value.split('.')[0]);
 let status='ready',paused=false;
 await page.route('**/api/queue',r=>r.fulfill({json:[{id:'invented',title:'An invented memo',status,awaiting_speakers:paused?1:0,awaiting_person:0,suggestion_count:2,error:null}]}));
 await page.reload();await expect(page.getByText('25 min 56 sec left')).toBeVisible();await expect(page.getByText('Your demo',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'About recording updates'})).toHaveCount(0);await expect(page.getByText(/Your recording is transcribed by/)).toHaveCount(0);await assertPhone(page);
 status='reading';await expect(page.getByRole('button',{name:'About recording updates'})).toBeVisible();await page.getByRole('button',{name:'About recording updates'}).click();await expect(page.getByRole('tooltip')).toContainText('KAI will email you');await assertPhone(page);await page.keyboard.press('Escape');await expect(page.getByRole('tooltip')).toHaveCount(0);
 status='waiting';paused=true;await expect(page.getByRole('button',{name:'About recording updates'})).toHaveCount(0);
 await page.goto('/upload/new');await expect(page.getByText(/Your recording is transcribed by/)).toBeVisible();await assertPhone(page);
 await page.goto('/terms');await expect(page.getByRole('heading',{name:'Demo terms and privacy'})).toBeVisible();await expect(page.getByText(/Your recording is transcribed by/)).toBeVisible();await assertPhone(page);
});
