import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US',
  });

  const cookiesData = fs.readFileSync(path.join(process.cwd(), '..', 'x.com_cookies.json'), 'utf-8');
  const rawCookies = JSON.parse(cookiesData).filter((c: any) => c.name && c.value).map((c: any) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    expires: c.expirationDate || -1, httpOnly: c.httpOnly || false,
    secure: c.secure || false, sameSite: 'Lax' as const,
  }));
  await context.addCookies(rawCookies);

  const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  // Intercept TweetDetail responses
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('TweetDetail')) {
      console.log(`API Response: ${resp.status()} ${url.slice(0, 100)}`);
      for (const [key, value] of resp.headers()) {
        if (key.startsWith('x-rate-limit')) console.log(`  ${key}: ${value}`);
      }
    }
  });

  // Try loading article directly
  console.log('Loading article page directly...');
  await page.goto('https://x.com/tonyler_/status/2020797517978329554', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);

  const broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
  const rateLimit = await page.evaluate(() => (document.body?.innerText || '').includes('rate limited'));
  console.log('Broken:', broken, 'Rate limited:', rateLimit);

  if (!broken && !rateLimit) {
    // Extract content
    const data = await page.evaluate(() => {
      let title = '';
      let content = '';

      const titleEl = document.querySelector('[data-testid="twitter-article-title"]') as any;
      if (titleEl) title = titleEl.innerText?.trim() || '';
      if (!title) {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent?.trim() || '';
      }

      for (const sel of ['[data-testid="twitterArticleRichTextView"]', '[data-testid="longformRichTextComponent"]', '[data-testid="twitterArticleReadView"]']) {
        const el = document.querySelector(sel) as any;
        if (el && el.innerText?.length > 100) {
          content = el.innerText.trim();
          break;
        }
      }

      // All data-testids
      const testids = Array.from(document.querySelectorAll('[data-testid]')).map((el: any) => ({
        id: el.getAttribute('data-testid'),
        len: el.innerText?.length || 0,
      })).filter((x: any) => x.len > 50);

      return { title, contentLength: content.length, contentPreview: content.slice(0, 300), testids };
    });

    console.log('Title:', data.title);
    console.log('Content length:', data.contentLength);
    console.log('Content preview:', data.contentPreview);
    console.log('Large testids:', JSON.stringify(data.testids, null, 2));
  } else {
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
    console.log('Page text:', bodyText);
  }

  await context.close();
  await browser.close();
  console.log('Done.');
})();
