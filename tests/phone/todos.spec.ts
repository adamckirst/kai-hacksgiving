import { test,expect } from './fixture';
import { assertPhone } from './usability';

test('yesterday is Overdue, urgency outranks names, and ticking finishes a promise',async({page,kai})=> {
  await page.goto('/');await page.evaluate(value=>{history.replaceState(null,'',`/#judge=${value}`);location.reload();},kai.secret);
  await page.getByRole('link',{name:'Try it yourself'}).click();
  const workspace=(await page.context().cookies()).find(c=>c.name==='kai_session')!.value.split('.')[0];
  const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
  kai.db.prepare("UPDATE todos SET due_on=? WHERE workspace_id=? AND text='Send Dana the pricing'").run(day(-1),workspace);
  kai.db.prepare("UPDATE todos SET due_on=? WHERE workspace_id=? AND text='Send the trial dates'").run(day(0),workspace);
  const insert=kai.db.prepare("INSERT INTO todos(id,workspace_id,text,owner_person_id,due_on,status,quote,conversation_id,person_id) VALUES (?,?,?,NULL,?,'open','I promised to send Dana the pricing.',?,?)");
  [['Today',day(0)],['Tomorrow',day(1)],['Next week',day(7)],['When ready',null]].forEach(([text,date],i)=>insert.run(workspace+':extra-'+i,workspace,text,date,workspace+':dana-call',workspace+':dana'));
  // A later-alphabet name ensures urgency wins over alphabetical order.
  kai.db.prepare("UPDATE people SET name='Zora Whitfield' WHERE workspace_id=? AND name='Dana Whitfield'").run(workspace);
  await page.goto('/people');await expect(page.getByRole('region',{name:'Needs you',exact:true}).locator('li').first()).toContainText('Zora Whitfield');
  await expect(page.getByRole('region',{name:'Needs you',exact:true}).locator('li').first().getByLabel('1 overdue',{exact:true})).toHaveText('1');
  await expect(page.getByRole('region',{name:'Needs you',exact:true}).locator('li').nth(1).getByLabel('1 due soon',{exact:true})).toHaveText('1');await assertPhone(page);
  await page.getByRole('link',{name:'To-dos',exact:true}).click();
  await expect(page.getByRole('region',{name:'Overdue',exact:true})).toContainText('Send Dana the pricing');
  await expect(page.getByRole('region',{name:'Due soon',exact:true})).toContainText('Today');
  await expect(page.getByRole('region',{name:'Due soon',exact:true})).toContainText('Tomorrow');
  await expect(page.getByRole('region',{name:'Later',exact:true})).toContainText('Next week');
  await expect(page.getByRole('region',{name:'No date',exact:true})).toContainText('When ready');await assertPhone(page);
  const checkbox=page.getByRole('checkbox',{name:'Mark Send Dana the pricing done',exact:true});
  await page.route('**/api/todos/*/done',route=>route.fulfill({status:500,json:{error:'Unavailable'}}));
  await checkbox.click();await expect(page.getByRole('alert')).toContainText('could not be finished');await expect(checkbox).toBeEnabled();
  await page.unroute('**/api/todos/*/done');await checkbox.click();await expect(checkbox).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Marked done.');await assertPhone(page);
  await page.getByRole('button',{name:'Waiting on',exact:true}).click();
  await expect(page.getByRole('region',{name:'Due soon',exact:true})).toContainText('Send the trial dates');
  await expect(page.getByRole('link',{name:'Ellis Rowan',exact:true})).toBeVisible();await assertPhone(page);
  await page.getByRole('checkbox',{name:'Mark Send the trial dates done',exact:true}).click();
  await expect(page.getByText('Nobody owes you anything right now.')).toBeVisible();await assertPhone(page);
  await page.goto('/people');await expect(page.getByRole('region',{name:'Needs you',exact:true})).not.toContainText('overdue');
  await page.getByRole('link',{name:/Zora Whitfield/}).click();await expect(page.getByText('Send Dana the pricing',{exact:true})).toHaveCount(0);
});

test('public To-dos can browse both views but cannot tick a promise',async({page})=> {
  await page.goto('/todos');await expect(page.getByText('A read-only demo with made-up data.')).toBeVisible();
  await expect(page.getByRole('region',{name:'Overdue',exact:true})).toContainText('Send Dana the pricing');
  await expect(page.getByRole('checkbox')).toHaveCount(0);await assertPhone(page);
  await page.getByRole('button',{name:'Waiting on',exact:true}).click();await expect(page.getByText('Send the trial dates',{exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);await assertPhone(page);
});
