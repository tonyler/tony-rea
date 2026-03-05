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

  // Intercept all API/GraphQL requests
  const apiCalls: { url: string; method: string }[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('graphql') || url.includes('/i/api') || url.includes('article')) {
      apiCalls.push({ url: url.slice(0, 250), method: req.method() });
    }
  });

  console.log('Loading articles tab...');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Dump full HTML structure of first card
  const cardStructure = await page.evaluate(() => {
    const cards = document.querySelectorAll('[data-testid="tweet"]');
    const results: any[] = [];

    for (let i = 0; i < Math.min(cards.length, 3); i++) {
      const card = cards[i] as HTMLElement;

      // Get all links in this card
      const links = Array.from(card.querySelectorAll('a[href]')).map((a: any) => ({
        href: a.href || a.getAttribute('href') || '',
        text: a.innerText?.trim()?.slice(0, 100) || '',
        role: a.getAttribute('role') || '',
        testid: a.getAttribute('data-testid') || '',
      }));

      // Get all clickable elements
      const clickable = Array.from(card.querySelectorAll('[role="button"], button, [role="link"]')).map((el: any) => ({
        tag: el.tagName,
        role: el.getAttribute('role') || '',
        testid: el.getAttribute('data-testid') || '',
        text: el.innerText?.trim()?.slice(0, 100) || '',
        ariaLabel: el.getAttribute('aria-label') || '',
      }));

      // Get card inner HTML structure (first 2000 chars)
      const html = card.innerHTML.slice(0, 3000);

      // Get card text
      const text = card.innerText?.trim() || '';

      results.push({
        index: i,
        textLength: text.length,
        text: text.slice(0, 500),
        links,
        clickable,
        htmlSnippet: html.slice(0, 1000),
      });
    }
    return results;
  });

  for (const card of cardStructure) {
    console.log(`\n=== Card ${card.index} (${card.textLength} chars) ===`);
    console.log('Text:', card.text);
    console.log('\nLinks:');
    for (const link of card.links) {
      console.log(`  href: ${link.href}`);
      console.log(`  text: ${link.text}`);
      console.log(`  testid: ${link.testid} role: ${link.role}`);
      console.log('  ---');
    }
    console.log('\nClickable elements:');
    for (const el of card.clickable) {
      console.log(`  ${el.tag} role=${el.role} testid=${el.testid} aria=${el.ariaLabel} text="${el.text.slice(0, 50)}"`);
    }
  }

  // Now try clicking the ARTICLE TITLE specifically (not the date/status link)
  console.log('\n\n=== Trying to click article title in first card ===');
  apiCalls.length = 0; // Reset API calls

  // Look for article cover image or title link
  const clickResult = await page.evaluate(() => {
    const card = document.querySelectorAll('[data-testid="tweet"]')[0] as HTMLElement;
    if (!card) return { success: false, reason: 'no card' };

    // Look for article cover (card with image that links to article)
    const articleCover = card.querySelector('[data-testid="card.wrapper"]') ||
                         card.querySelector('[data-testid="card.layoutLarge.media"]') ||
                         card.querySelector('[data-testid="tweetPhoto"]');
    if (articleCover) {
      (articleCover as HTMLElement).click();
      return { success: true, target: 'articleCover' };
    }

    // Look for the article title link
    const links = card.querySelectorAll('a[href]');
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href || '';
      const text = (link as HTMLElement).innerText?.trim() || '';
      // Skip date/time links and metric links
      if (text.length > 20 && !href.includes('/analytics') && !text.match(/^\d/)) {
        (link as HTMLElement).click();
        return { success: true, target: 'titleLink', text: text.slice(0, 80), href };
      }
    }

    return { success: false, reason: 'no suitable click target' };
  });

  console.log('Click result:', JSON.stringify(clickResult));
  await page.waitForTimeout(10000);

  console.log('\nURL after click:', page.url());
  const bodyAfter = await page.evaluate(() => document.body?.innerText?.slice(0, 800) || '');
  console.log('Body after click:', bodyAfter.slice(0, 400));

  // Check for article content
  const articleContent = await page.evaluate(() => {
    const selectors = [
      '[data-testid="twitterArticleRichTextView"]',
      '[data-testid="longformRichTextComponent"]',
      '[data-testid="twitterArticleReadView"]',
      'article',
      '[role="article"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        return { selector: sel, length: (el as HTMLElement).innerText?.length || 0, preview: (el as HTMLElement).innerText?.slice(0, 300) || '' };
      }
    }
    return null;
  });
  console.log('Article content:', JSON.stringify(articleContent));

  console.log('\nAPI calls during navigation:');
  for (const call of apiCalls) {
    console.log(`  ${call.method} ${call.url}`);
  }

  await context.close();
  await browser.close();
  console.log('\nDone.');
})();
