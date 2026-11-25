// Measures every state of the gallery on a phone, and photographs it.
//
//   npx vite --config design/vite.config.ts          (in one terminal)
//   PLAYWRIGHT_BROWSERS_PATH=.playwright node design/check.mjs
//
// The rules are the PRD's U6 to U8, at 375 px wide:
//   - no sideways scroll; no text under 16 px; no link, button or field under 44 px;
//   - exactly one filled violet button: the screen's one action;
//   - none of the words the screens never say.
// It prints what fails and exits 1; with nothing to report it exits 0.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:18560/'
const shots = new URL('./shots/', import.meta.url).pathname
mkdirSync(shots, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })
await page.goto(base)
const states = await page.locator('main a').evaluateAll((links) => links.map((link) => link.getAttribute('href').slice(2)))

let failures = 0
for (const state of states) {
  await page.goto(base + '#/' + state)
  await page.reload()
  await page.waitForTimeout(600)
  const issues = await page.evaluate(() => {
    const issues = []
    const banned = document.body.innerText.match(/\b(AI|LLM|entity|extract|prompt|token)\b/i)
    if (banned) issues.push('a word the screens never say: ' + banned[0])
    if (document.documentElement.scrollWidth > innerWidth) issues.push('sideways scroll')
    for (const el of document.querySelectorAll('body *')) {
      if (!el.getClientRects().length || el.closest('svg')) continue
      const ownText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      if (ownText && parseFloat(getComputedStyle(el).fontSize) < 16) issues.push('small text: ' + el.textContent.trim().slice(0, 40))
    }
    for (const el of document.querySelectorAll('a,button,input,select,textarea')) {
      if (el.hasAttribute('data-headlessui-focus-guard')) continue // the kit's unseen focus keepers
      const box = el.getBoundingClientRect()
      if (box.width < 44 || box.height < 44) issues.push(`small target (${Math.round(box.width)}×${Math.round(box.height)}): ` + (el.textContent.trim() || el.getAttribute('aria-label') || el.id).slice(0, 40))
    }
    const probe = document.createElement('span')
    probe.style.backgroundColor = 'var(--color-violet-600)'
    document.body.append(probe)
    const violet = getComputedStyle(probe).backgroundColor
    probe.remove()
    const filled = [...document.querySelectorAll('a,button')].filter((el) => getComputedStyle(el).backgroundColor === violet)
    if (filled.length !== 1) issues.push(`${filled.length} filled violet buttons: ` + filled.map((el) => el.textContent.trim()).join(' | '))
    return issues
  })
  await page.screenshot({ path: `${shots}${state.replaceAll('/', '-')}.png` })
  console.log(issues.length ? 'FAIL' : 'ok  ', state, issues.length ? '\n      ' + issues.join('\n      ') : '')
  failures += issues.length
}
await browser.close()
console.log(failures ? `\n${failures} things to fix` : `\nAll ${states.length} states pass.`)
process.exit(failures ? 1 : 0)
