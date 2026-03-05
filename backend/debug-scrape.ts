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

  // Warm up with home page
  console.log('Visiting home...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const homeLen = await page.evaluate(() => document.body?.innerText?.length || 0);
  console.log('Home:', homeLen, 'chars');

  // Visit article
  console.log('\nVisiting article...');
  await page.goto('https://x.com/tonyler_/status/2020797517978329554', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  let bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
  let broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
  console.log('Body:', bodyLen, 'chars, broken:', broken);

  // Retry if broken
  if (broken) {
    console.log('Clicking Retry...');
    const btn = page.locator('text=Retry').first();
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(10000);
      bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
      broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
      console.log('After retry:', bodyLen, 'chars, broken:', broken);
    }
  }

  // Full reload if still broken
  if (broken) {
    console.log('Full reload...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(10000);
    bodyLen = await page.evaluate(() => document.body?.innerText?.length || 0);
    broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
    console.log('After reload:', bodyLen, 'chars, broken:', broken);
  }

  await page.screenshot({ path: '/tmp/x-debug-final.png', fullPage: true });

  if (!broken) {
    const testIds = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-testid]');
      return Array.from(els).map(el => el.getAttribute('data-testid'));
    });
    console.log('testids:', testIds.join(', '));
    const body = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || '');
    console.log('Content:', body);
  } else {
    console.log('Still broken after all retries');
  }

  await context.close();
  await browser.close();
})();
