import { expect, type Page } from '@playwright/test';
export async function assertPhone(page:Page) {
    await expect(page.locator('body')).not.toContainText(/\b(AI|LLM|entity|extract|prompt|token)\b/i);
    const issues = await page.evaluate(() => {
      const issues:string[]=[];
      if (document.documentElement.scrollWidth > innerWidth) issues.push('sideways scroll');
      for (const el of document.querySelectorAll<HTMLElement>('body *')) {
        if (!el.getClientRects().length) continue;
        if ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) && parseFloat(getComputedStyle(el).fontSize)<16) issues.push('small text: '+el.textContent);
      }
      for (const el of document.querySelectorAll('a,button,input,select,textarea')) {
        const r=el.getBoundingClientRect();
        if (r.width<44 || r.height<44) issues.push('small target: '+el.textContent);
      }
      return issues;
    });
    expect(issues).toEqual([]);
    const filled = await page.locator('a,button').evaluateAll(elements => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'var(--color-violet-500)';
      document.body.append(probe);
      const violet = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return elements.filter(el => getComputedStyle(el).backgroundColor === violet || getComputedStyle(el, '::before').backgroundColor === violet).length;
    });
    expect(filled).toBe(1);
}
