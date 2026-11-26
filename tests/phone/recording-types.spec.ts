import {test,expect} from './fixture';
import {assertPhone} from './usability';
import {testTone} from '../../src/server/gateway';
test('recording type makes speaker timing explicit; meetings wait for speaker names before suggestions',async({page,kai})=>{
 await page.goto('/');await page.evaluate(s=>{history.replaceState(null,'','/#judge='+s);location.reload()},kai.secret);
 await page.getByRole('link',{name:'Try it yourself',exact:true}).click();await page.goto('/upload/new');
 const picker=page.getByLabel('Add recordings: choose up to five audio files');await expect(picker).toBeDisabled();
 await page.getByRole('button',{name:/^Memo from me/}).click();await expect(picker).toBeEnabled();await expect(page.getByLabel('Who is speaking?',{exact:true})).toHaveCount(0);await assertPhone(page);
 await page.getByRole('button',{name:/^Voice note from someone else/}).click();await expect(picker).toBeDisabled();await expect(page.getByLabel('Who is speaking?',{exact:true})).toBeVisible();
 await page.getByLabel('Who is speaking?',{exact:true}).selectOption('new');await page.getByLabel('Name',{exact:true}).fill('Avery Fern');await expect(picker).toBeEnabled();await assertPhone(page);
 await page.getByRole('button',{name:/^Multiple speakers/}).click();await expect(page.getByLabel('Who is speaking?',{exact:true})).toHaveCount(0);await expect(picker).toBeEnabled();await assertPhone(page);
 await picker.setInputFiles({name:'invented-meeting.wav',mimeType:'audio/wav',buffer:testTone()});
 await expect(page.getByRole('heading',{name:'Who said what?',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Create suggestions',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:/^Accept all/})).toHaveCount(0);await assertPhone(page);
 const id=new URL(page.url()).pathname.split('/').pop()!;const before=await (await page.request.get('/api/readings/'+id)).json();expect(before.suggestions).toHaveLength(0);expect(before.awaiting_speakers).toBe(1);
 await page.reload();await expect(page.getByRole('heading',{name:'Who said what?',exact:true})).toBeVisible();
 const people=await (await page.request.get('/api/people')).json();await page.getByLabel('Who is speaker A?',{exact:true}).selectOption('owner');await page.getByLabel('Who is speaker B?',{exact:true}).selectOption(people.find((p:any)=>p.name==='Dana Whitfield').id);await assertPhone(page);
 await page.getByRole('button',{name:'Create suggestions',exact:true}).click();await expect(page.getByRole('button',{name:/^Accept all/})).toBeEnabled();
 const after=await (await page.request.get('/api/readings/'+id)).json();expect(after.awaiting_speakers).toBe(0);expect(after.recording_type).toBe('multiple');await assertPhone(page);
});
