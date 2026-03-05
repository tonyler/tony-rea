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

  // Test 1: Can we even load the articles tab still?
  console.log('Test 1: Loading articles tab...');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
  const isRateLimited = bodyText.includes('rate limited');
  const hasSomethingWrong = bodyText.includes('Something went wrong');
  console.log('Rate limited:', isRateLimited);
  console.log('Something wrong:', hasSomethingWrong);
  console.log('Body preview:', bodyText.slice(0, 200));

  // Count articles on articles tab
  const articleCount = await page.evaluate(() => {
    return document.querySelectorAll('[data-testid="tweet"]').length;
  });
  console.log('Article cards visible:', articleCount);

  // Test 2: Try loading one article URL directly
  console.log('\nTest 2: Direct URL after 30s wait...');
  await page.waitForTimeout(30000);

  await page.goto('https://x.com/tonyler_/status/2020797517978329554', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);

  const body2 = await page.evaluate(() => document.body?.innerText?.slice(0, 800) || '');
  const broken2 = body2.includes('Something went wrong');
  const rateLimit2 = body2.includes('rate limited');
  console.log('Rate limited:', rateLimit2, 'Broken:', broken2);
  console.log('Body:', body2.slice(0, 300));

  // Check for article content
  const hasArticleContent = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="twitterArticleRichTextView"]') ||
               document.querySelector('[data-testid="longformRichTextComponent"]') ||
               document.querySelector('[data-testid="twitterArticleReadView"]');
    return el ? (el as any).innerText?.length || 0 : 0;
  });
  console.log('Article content chars:', hasArticleContent);

  // Test 3: Try with a completely new context (fresh session)
  console.log('\nTest 3: Fresh context...');
  await context.close();

  const context2 = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  await context2.addCookies(rawCookies);

  const page2 = await context2.newPage();
  await page2.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  await page2.goto('https://x.com/tonyler_/status/2020797517978329554', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page2.waitForTimeout(10000);

  const body3 = await page2.evaluate(() => document.body?.innerText?.slice(0, 800) || '');
  const broken3 = body3.includes('Something went wrong');
  const rateLimit3 = body3.includes('rate limited');
  console.log('Rate limited:', rateLimit3, 'Broken:', broken3);
  console.log('Body:', body3.slice(0, 300));

  const hasContent3 = await page2.evaluate(() => {
    const el = document.querySelector('[data-testid="twitterArticleRichTextView"]') ||
               document.querySelector('[data-testid="longformRichTextComponent"]') ||
               document.querySelector('[data-testid="twitterArticleReadView"]');
    return el ? (el as any).innerText?.length || 0 : 0;
  });
  console.log('Article content chars:', hasContent3);

  // Show all data-testid elements
  const testIds = await page2.evaluate(() => {
    const els = document.querySelectorAll('[data-testid]');
    return Array.from(els).map(el => ({
      id: el.getAttribute('data-testid'),
      len: (el as HTMLElement).innerText?.length || 0,
    })).filter(x => x.len > 50);
  });
  console.log('Large testids:', JSON.stringify(testIds, null, 2));

  await context2.close();
  await browser.close();
  console.log('\nDone.');
})();
