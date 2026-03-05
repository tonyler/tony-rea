import { chromium } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

function transformCookiesForPlaywright(cookies: any[]): any[] {
  return cookies
    .filter((c) => c.name && c.value)
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expirationDate || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite:
        c.sameSite === 'no_restriction'
          ? 'None'
          : c.sameSite === 'lax'
            ? 'Lax'
            : c.sameSite === 'strict'
              ? 'Strict'
              : 'Lax',
    }));
}

async function testScrape() {
  const handle = 'tonyler_';

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Load cookies
  try {
    const cookiesData = await fs.readFile(path.join(process.cwd(), '..', 'x.com_cookies.json'), 'utf-8');
    const rawCookies = JSON.parse(cookiesData);
    const cookies = transformCookiesForPlaywright(rawCookies);
    await context.addCookies(cookies);
    console.log(`Loaded ${cookies.length} cookies`);
  } catch (e: any) {
    console.log(`Cookie load failed: ${e.message}`);
  }

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  // Step 1: Navigate to articles page
  const articlesUrl = `https://x.com/${handle}/articles`;
  console.log(`\n=== STEP 1: Navigate to ${articlesUrl} ===`);

  try {
    await page.goto(articlesUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);

    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || 'NO BODY');
    console.log(`\nPage text (first 2000 chars):\n${bodyText}`);

    // Check for login wall
    const hasSignIn = bodyText.includes('Sign in');
    const hasSignUp = bodyText.includes('Sign up');
    console.log(`\nLogin wall indicators: Sign in=${hasSignIn}, Sign up=${hasSignUp}`);

    // Look for links
    const allLinks = await page.evaluate((h) => {
      const links: string[] = [];
      document.querySelectorAll('a[href]').forEach((a: any) => {
        const href = a.href || '';
        if (href.includes('/status/')) {
          links.push(href);
        }
      });
      return links;
    }, handle);
    console.log(`\nFound ${allLinks.length} status links:`);
    allLinks.forEach(l => console.log(`  ${l}`));

    // Take a screenshot for debugging
    await page.screenshot({ path: '/root/tony-rea/backend/debug-articles-page.png', fullPage: true });
    console.log('\nScreenshot saved to debug-articles-page.png');

    // Step 2: If we found article URLs, try scraping the first one
    if (allLinks.length > 0) {
      const firstUrl = allLinks[0];
      console.log(`\n=== STEP 2: Scrape first article: ${firstUrl} ===`);

      await page.goto(firstUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(5000);

      const articleText = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || 'NO BODY');
      console.log(`\nArticle page text (first 3000 chars):\n${articleText}`);

      // Try extracting content
      const extracted = await page.evaluate(() => {
        const result: Record<string, string> = {};

        // Title attempts
        const titleEl = document.querySelector('[data-testid="twitter-article-title"]') as any;
        result['title_testid'] = titleEl?.innerText || 'NOT FOUND';

        const h1 = document.querySelector('h1');
        result['title_h1'] = h1?.textContent || 'NOT FOUND';

        // Content attempts
        const richText = document.querySelector('[data-testid="twitterArticleRichTextView"]') as any;
        result['content_richText'] = richText ? `FOUND (${richText.innerText?.length} chars)` : 'NOT FOUND';

        const longform = document.querySelector('[data-testid="longformRichTextComponent"]') as any;
        result['content_longform'] = longform ? `FOUND (${longform.innerText?.length} chars)` : 'NOT FOUND';

        const readView = document.querySelector('[data-testid="twitterArticleReadView"]') as any;
        result['content_readView'] = readView ? `FOUND (${readView.innerText?.length} chars)` : 'NOT FOUND';

        const tweet = document.querySelector('[data-testid="tweet"]') as any;
        result['tweet'] = tweet ? `FOUND (${tweet.innerText?.length} chars)` : 'NOT FOUND';

        const primaryCol = document.querySelector('[data-testid="primaryColumn"]') as any;
        result['primaryColumn'] = primaryCol ? `FOUND (${primaryCol.innerText?.length} chars)` : 'NOT FOUND';

        // List all data-testid attributes on page
        const testIds = new Set<string>();
        document.querySelectorAll('[data-testid]').forEach((el: any) => {
          testIds.add(el.getAttribute('data-testid'));
        });
        result['all_testids'] = Array.from(testIds).join(', ');

        return result;
      });

      console.log('\nExtraction results:');
      Object.entries(extracted).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

      await page.screenshot({ path: '/root/tony-rea/backend/debug-article-content.png', fullPage: true });
      console.log('\nArticle screenshot saved to debug-article-content.png');
    }

  } catch (err: any) {
    console.error(`Error: ${err.message}`);
  }

  await context.close();
  await browser.close();
}

testScrape().catch(console.error);
