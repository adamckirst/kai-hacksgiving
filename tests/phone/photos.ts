import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
// Only explicit local capture runs make these artifacts. Tests use invented data;
// Connect is intercepted with invalid layout addresses before any photo.
export async function photograph(page:Page,name:string) {
  if(process.env.KAI_SCREENSHOTS!=='1')return;
  await mkdir('.data/app-shots',{recursive:true});
  await page.evaluate(()=>document.fonts.ready);
  await page.mouse.move(0,0);
  const height=await page.evaluate(()=>document.documentElement.scrollHeight);
  await page.setViewportSize({width:375,height:Math.max(812,height)});
  await page.screenshot({path:'.data/app-shots/'+name+'.png',animations:'disabled'});
  await page.setViewportSize({width:375,height:812});
}
