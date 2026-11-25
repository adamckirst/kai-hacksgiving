import { assertPhone } from './usability';
import { test, expect } from './fixture';
for (const route of ['/','/people','/home','/todos','/connect']) {
  test(`${route}: U6–U8 at 375 px`,async ({page}) => {
    await page.goto(route);
    await expect(page.getByRole('status')).toHaveCount(0);
    if (route === '/people') {
      await expect(page.getByRole('heading',{name:'Dana Whitfield'}).first()).toBeVisible();
      await expect(page.locator('.everyone h3')).toHaveText(['Dana Whitfield','Ellis Rowan','Nia Calder']);
    }
    await assertPhone(page);
    await page.locator('.primary').click();
    await expect(page).toHaveURL(route === '/people' || route === '/' ? /\/home$/ : /\/people$/);
  });
}
