import { expect, type Page } from '@playwright/test';
export async function assertPhone(page:Page) {
    await expect(page.locator('body')).not.toContainText(/\b(AI|LLM|entity|extract|prompt|token)\b/i);
    await expect.poll(async()=>page.evaluate(() => {
      const issues:string[]=[];
      if (document.documentElement.scrollWidth > innerWidth) issues.push('sideways scroll');
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (!el.getClientRects().length) continue;
        if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) && parseFloat(getComputedStyle(el).fontSize)<16) issues.push('small text: '+el.textContent);
      }
      for (const el of document.querySelectorAll('a,button,input,select,textarea')) {
        if(el.hasAttribute('data-headlessui-focus-guard'))continue;
        const r=el.getBoundingClientRect();
        if (r.width<44 || r.height<44) issues.push('small target: '+el.textContent);
      }
      return issues;
    })).toEqual([]);
    await expect.poll(async()=>page.locator('a,button').evaluateAll(elements => {
      const probe=document.createElement('span');document.body.append(probe);
      const violet=['600','700','800'].map(shade=>{probe.style.backgroundColor=`var(--color-violet-${shade})`;return getComputedStyle(probe).backgroundColor;});
      probe.remove();
      return elements.filter(el=>violet.includes(getComputedStyle(el).backgroundColor)).length;
    })).toBe(1);
}
