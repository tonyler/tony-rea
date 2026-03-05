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

  // Test 1: stacy_muur article (different user)
  console.log('--- Test stacy_muur article ---');
  await page.goto('https://x.com/stacy_muur/status/2019325467116126348', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  let broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
  let bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
  console.log('stacy_muur:', bodyLen, 'chars, broken:', broken);

  // Test 2: Try syndication/embed API approach
  console.log('\n--- Test syndication API ---');
  const statusId = '2020797517978329554';
  const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/tonyler_`;
  await page.goto(syndicationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
  console.log('Syndication:', bodyLen, 'chars');

  // Test 3: Try publish.twitter.com oembed
  console.log('\n--- Test oembed API ---');
  const oembedUrl = `https://publish.twitter.com/oembed?url=https://x.com/tonyler_/status/${statusId}`;
  const resp = await page.evaluate(async (url: string) => {
    try {
      const r = await fetch(url);
      const data = await r.json();
      return { ok: true, html_length: data.html?.length || 0, html: data.html?.slice(0, 500) || '' };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, oembedUrl);
  console.log('oembed:', JSON.stringify(resp));

  // Test 4: Navigate within X app (SPA navigation) instead of hard goto
  console.log('\n--- Test SPA navigation from profile ---');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);
  broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
  bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
  console.log('Articles tab:', bodyLen, 'chars, broken:', broken);

  if (!broken) {
    // Click the first article link instead of navigating directly
    const articleLink = await page.locator('a[href*="/status/"]').first();
    if (await articleLink.isVisible()) {
      console.log('Clicking first article link...');
      await articleLink.click();
      await page.waitForTimeout(8000);
      broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
      bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
      console.log('After click:', bodyLen, 'chars, broken:', broken);
      await page.screenshot({ path: '/tmp/x-spa-nav.png', fullPage: true });
      if (!broken && bodyLen > 200) {
        const body = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
        console.log('Content preview:', body.slice(0, 300));
      }
    }
  }

  await context.close();
  await browser.close();
})();
