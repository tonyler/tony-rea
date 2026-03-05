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

  // Step 1: Load articles tab
  console.log('Loading articles tab...');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Step 2: Collect first few article URLs
  const urls = await page.evaluate(() => {
    const links: string[] = [];
    document.querySelectorAll('a[href]').forEach((a: any) => {
      const href = a.href || '';
      if (href.toLowerCase().includes('/tonyler_/status/') && !href.includes('/analytics')) {
        links.push(href);
      }
    });
    return [...new Set(links)];
  });
  console.log(`Found ${urls.length} article URLs on first screen`);

  if (urls.length === 0) {
    console.log('No URLs found, dumping page text...');
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || '');
    console.log(text);
    await context.close();
    await browser.close();
    return;
  }

  // Step 3: Try clicking the first article link (SPA navigation)
  const firstUrl = urls[0];
  const statusId = firstUrl.match(/\/status\/(\d+)/)?.[1];
  console.log(`\nTrying SPA click on article with status ID: ${statusId}`);

  // Find and click the link
  const clicked = await page.evaluate((sid) => {
    const allLinks = document.querySelectorAll('a[href]');
    for (const a of allLinks) {
      const href = (a as HTMLAnchorElement).href || '';
      if (href.includes(`/status/${sid}`)) {
        (a as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, statusId);

  if (!clicked) {
    console.log('Could not find link to click!');
    await context.close();
    await browser.close();
    return;
  }

  console.log('Clicked! Waiting for navigation...');
  await page.waitForTimeout(8000);

  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Check if article loaded
  const broken = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
  console.log('Broken:', broken);

  if (!broken) {
    // Try extracting article content
    const data = await page.evaluate(() => {
      let title = '';
      let content = '';

      const titleEl = document.querySelector('[data-testid="twitter-article-title"]') as any;
      if (titleEl) title = titleEl.innerText?.trim() || '';
      if (!title) {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent?.trim() || '';
      }

      const richTextView = document.querySelector('[data-testid="twitterArticleRichTextView"]') as any;
      if (richTextView) content = richTextView.innerText?.trim() || '';
      if (!content) {
        const longform = document.querySelector('[data-testid="longformRichTextComponent"]') as any;
        if (longform) content = longform.innerText?.trim() || '';
      }
      if (!content) {
        const readView = document.querySelector('[data-testid="twitterArticleReadView"]') as any;
        if (readView) content = readView.innerText?.trim() || '';
      }

      return { title, contentLength: content.length, contentPreview: content.slice(0, 300) };
    });

    console.log('Title:', data.title);
    console.log('Content length:', data.contentLength);
    console.log('Content preview:', data.contentPreview);

    // Step 4: Go back and try second article
    console.log('\nGoing back...');
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000);

    const backUrl = page.url();
    console.log('Back URL:', backUrl);

    // Check if articles tab is restored
    const urls2 = await page.evaluate(() => {
      const links: string[] = [];
      document.querySelectorAll('a[href]').forEach((a: any) => {
        const href = a.href || '';
        if (href.toLowerCase().includes('/tonyler_/status/') && !href.includes('/analytics')) {
          links.push(href);
        }
      });
      return [...new Set(links)];
    });
    console.log(`After going back, found ${urls2.length} article URLs`);

    if (urls.length > 1) {
      const secondUrl = urls[1];
      const sid2 = secondUrl.match(/\/status\/(\d+)/)?.[1];
      console.log(`\nTrying second article: ${sid2}`);

      const clicked2 = await page.evaluate((sid) => {
        const allLinks = document.querySelectorAll('a[href]');
        for (const a of allLinks) {
          const href = (a as HTMLAnchorElement).href || '';
          if (href.includes(`/status/${sid}`)) {
            (a as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, sid2);

      if (clicked2) {
        await page.waitForTimeout(8000);
        const broken2 = await page.evaluate(() => (document.body?.innerText || '').includes('Something went wrong'));
        console.log('Second article broken:', broken2);

        if (!broken2) {
          const data2 = await page.evaluate(() => {
            let title = '';
            const titleEl = document.querySelector('[data-testid="twitter-article-title"]') as any;
            if (titleEl) title = titleEl.innerText?.trim() || '';
            if (!title) {
              const h1 = document.querySelector('h1');
              if (h1) title = h1.textContent?.trim() || '';
            }
            let content = '';
            const richTextView = document.querySelector('[data-testid="twitterArticleRichTextView"]') as any;
            if (richTextView) content = richTextView.innerText?.trim() || '';
            if (!content) {
              const longform = document.querySelector('[data-testid="longformRichTextComponent"]') as any;
              if (longform) content = longform.innerText?.trim() || '';
            }
            return { title, contentLength: content.length };
          });
          console.log('Second article title:', data2.title);
          console.log('Second article content length:', data2.contentLength);
        }
      }
    }
  } else {
    console.log('SPA navigation also blocked!');
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || '');
    console.log(text);
  }

  await context.close();
  await browser.close();
  console.log('\nDone.');
})();
