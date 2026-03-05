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

  // Go to articles tab
  console.log('Loading articles tab...');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Dump full page structure
  const body = await page.evaluate(() => document.body?.innerText || '');
  console.log('Full body text (' + body.length + ' chars):');
  console.log(body);
  console.log('\n---\n');

  // Look at all links on the page
  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href]');
    return Array.from(anchors).map(a => ({
      href: a.getAttribute('href') || '',
      text: (a as HTMLElement).innerText?.slice(0, 80) || '',
    })).filter(l => l.href.includes('/status/') || l.href.includes('/article'));
  });
  console.log('Article links:', JSON.stringify(links, null, 2));

  // Check for article cards/previews
  const cards = await page.evaluate(() => {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    return Array.from(tweets).map((t, i) => {
      const el = t as HTMLElement;
      return {
        index: i,
        textLength: el.innerText?.length || 0,
        text: el.innerText?.slice(0, 300) || '',
      };
    });
  });
  console.log('\nTweet cards:', JSON.stringify(cards, null, 2));

  // Try scrolling for more content
  console.log('\nScrolling...');
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1500);
  }

  const afterScroll = await page.evaluate(() => document.body?.innerText?.length || 0);
  console.log('After scroll:', afterScroll, 'chars');

  await page.screenshot({ path: '/tmp/x-articles-tab.png', fullPage: true });
  console.log('Screenshot saved');

  await context.close();
  await browser.close();
})();
