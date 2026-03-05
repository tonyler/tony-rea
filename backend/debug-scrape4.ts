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

  // Go to articles tab, click first article card to try expanding it
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Try clicking on the article text (not the date link) to see if it opens inline
  const firstCard = page.locator('[data-testid="tweet"]').first();
  const articleText = firstCard.locator('text=Cosmos is the home of RWAs');
  if (await articleText.isVisible()) {
    console.log('Clicking article title text...');
    await articleText.click();
    await page.waitForTimeout(8000);

    const url = page.url();
    console.log('URL after click:', url);

    const bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
    const broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
    console.log('Body:', bodyLen, 'chars, broken:', broken);

    if (!broken && bodyLen > 500) {
      await page.screenshot({ path: '/tmp/x-article-expanded.png', fullPage: true });
      const testIds = await page.evaluate(() => {
        const els = document.querySelectorAll('[data-testid]');
        return Array.from(els).map(el => ({
          id: el.getAttribute('data-testid'),
          len: (el as HTMLElement).innerText?.length || 0,
        })).filter(x => x.len > 100);
      });
      console.log('Large testids:', JSON.stringify(testIds, null, 2));

      const body = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '');
      console.log('\nContent:\n', body);
    }
  }

  // Try a completely different approach: X article URLs might be /i/article/...
  console.log('\n--- Try /i/article format ---');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Look for any links that contain "article" in the href
  const allLinks = await page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href]');
    return Array.from(anchors).map(a => a.getAttribute('href') || '').filter(h => h.length > 5);
  });
  console.log('All unique links:', [...new Set(allLinks)].join('\n'));

  // Try intercepting network requests to find the article API
  console.log('\n--- Network approach: intercept API calls ---');
  const apiCalls: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('article')) {
      apiCalls.push(url.slice(0, 200));
    }
  });

  // Click the first article again via navigation
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Click on the article card area
  const card = page.locator('[data-testid="tweet"]').first();
  await card.click();
  await page.waitForTimeout(5000);

  console.log('API calls intercepted:');
  for (const call of apiCalls.slice(0, 20)) {
    console.log(' ', call);
  }

  await context.close();
  await browser.close();
})();
