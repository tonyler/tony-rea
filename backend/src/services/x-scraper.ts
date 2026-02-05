/* eslint-disable @typescript-eslint/no-explicit-any */
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

declare const navigator: any;
declare const window: any;
declare const document: any;

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

export interface Article {
  title: string;
  content: string;
  views: number;
  likes: number;
  score: number;
  url: string;
  datePosted: string;
}

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browser;
}

async function createMobileContext(browser: Browser): Promise<BrowserContext> {
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

  // Load X cookies for authentication
  const possiblePaths = [
    path.join(process.cwd(), 'x.com_cookies.json'),
    path.join(process.cwd(), '..', 'x.com_cookies.json'),
  ];

  for (const cookiesPath of possiblePaths) {
    try {
      const cookiesData = await fs.readFile(cookiesPath, 'utf-8');
      const rawCookies = JSON.parse(cookiesData);
      const cookies = transformCookiesForPlaywright(rawCookies);
      await context.addCookies(cookies);
      console.log(`Loaded ${cookies.length} cookies from ${cookiesPath}`);
      break;
    } catch {
      // Try next path
    }
  }

  return context;
}

async function createStealthPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  return page;
}

async function detectLoginWall(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = document.body?.innerText || '';
    return text.includes('Sign in') && text.includes('Sign up') && !text.includes('article');
  });
}

async function collectArticleUrls(page: Page, handle: string): Promise<string[]> {
  const allUrls = new Set<string>();

  const collect = async () => {
    const urls = await page.evaluate((h) => {
      const hLower = h.toLowerCase();
      const links: string[] = [];
      // Primary selector: anchor links (case-insensitive handle match)
      document.querySelectorAll('a[href]').forEach((a: any) => {
        const href = a.href || '';
        if (href.toLowerCase().includes(`/${hLower}/status/`) && !href.includes('/analytics')) {
          links.push(href);
        }
      });
      // Fallback: look for article-like links in different DOM structures
      if (links.length === 0) {
        document.querySelectorAll('[role="link"], [data-testid="tweet"] a').forEach((el: any) => {
          const href = el.href || el.getAttribute('href') || '';
          if (href.toLowerCase().includes(`/${hLower}/status/`) && !href.includes('/analytics')) {
            links.push(href.startsWith('http') ? href : `https://x.com${href}`);
          }
        });
      }
      return links;
    }, handle);
    urls.forEach((u) => allUrls.add(u));
  };

  // Initial collection
  await collect();

  let noNewCount = 0;
  let previousTotal = allUrls.size;

  // Increase max scroll iterations and scroll distance for mobile viewport
  for (let i = 0; i < 150; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(1000);
    await collect();

    if (allUrls.size === previousTotal) {
      noNewCount++;
      if (noNewCount >= 10) break;
    } else {
      noNewCount = 0;
      if (i % 5 === 0) {
        console.log(`  Collected ${allUrls.size} articles...`);
      }
    }
    previousTotal = allUrls.size;
  }

  return Array.from(allUrls);
}

async function extractArticleContent(page: Page): Promise<{ title: string; content: string; views: number; likes: number; datePosted: string }> {
  // Wait for content to render
  try {
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
  } catch {
    // Continue even if not found
  }

  // Note: Do NOT click article cover - it expands quoted articles instead of the main one

  return page.evaluate(() => {
    let title = '';
    let content = '';
    let views = 0;
    let likes = 0;
    let datePosted = '';

    // Get title from twitter-article-title or h1
    const titleEl = document.querySelector('[data-testid="twitter-article-title"]') as any;
    if (titleEl) {
      title = titleEl.innerText?.trim() || '';
    }
    if (!title) {
      const h1 = document.querySelector('h1');
      if (h1) title = h1.textContent?.trim() || '';
    }

    // Get content from twitterArticleRichTextView or longformRichTextComponent
    const richTextView = document.querySelector('[data-testid="twitterArticleRichTextView"]') as any;
    if (richTextView) {
      content = richTextView.innerText?.trim() || '';
    }

    if (!content) {
      const longform = document.querySelector('[data-testid="longformRichTextComponent"]') as any;
      if (longform) {
        content = longform.innerText?.trim() || '';
      }
    }

    // Fallback: look for article read view
    if (!content) {
      const readView = document.querySelector('[data-testid="twitterArticleReadView"]') as any;
      if (readView) {
        content = readView.innerText?.trim() || '';
      }
    }

    // Fallback for inline thread articles: get content from tweet
    if (!content) {
      const tweet = document.querySelector('[data-testid="tweet"]') as any;
      if (tweet) {
        const tweetText = tweet.innerText || '';
        // Extract the main content (skip username, handle, metrics)
        const lines = tweetText.split('\n');
        const startIdx = lines.findIndex((l: string) => l.length > 50 && !l.startsWith('@') && !l.match(/^\d/));
        if (startIdx >= 0) {
          // First long line is likely the title
          title = lines[startIdx] || '';
          // Rest is content
          content = lines.slice(startIdx + 1).join('\n').trim();
        }
      }
    }

    // Extract date from time[datetime] element
    const timeEl = document.querySelector('time[datetime]');
    if (timeEl) {
      datePosted = timeEl.getAttribute('datetime') || '';
    }

    // Parse views using regex that matches "X Views" pattern
    const pageText = document.body.innerText || '';
    const viewsMatch = pageText.match(/(\d+[\d,.]*[KM]?)\s*Views?/i);
    if (viewsMatch) {
      const num = viewsMatch[1].replace(/,/g, '');
      if (num.includes('K')) views = Math.round(parseFloat(num) * 1000);
      else if (num.includes('M')) views = Math.round(parseFloat(num) * 1000000);
      else views = parseInt(num, 10) || 0;
    }

    // Find likes from like button
    const likeButton = document.querySelector('[data-testid="like"]');
    if (likeButton) {
      const likeText = likeButton.textContent?.trim() || '0';
      const cleaned = likeText.replace(/,/g, '');
      if (cleaned.includes('K')) likes = Math.round(parseFloat(cleaned) * 1000);
      else if (cleaned.includes('M')) likes = Math.round(parseFloat(cleaned) * 1000000);
      else likes = parseInt(cleaned, 10) || 0;
    }

    return { title, content, views, likes, datePosted };
  });
}

async function navigateWithRetry(page: Page, url: string, maxRetries: number = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeout = 30000 + (attempt - 1) * 15000;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(5000 + (attempt - 1) * 3000);

      const isLoginWall = await detectLoginWall(page);
      if (isLoginWall) {
        console.log(`  Login wall detected (attempt ${attempt}/${maxRetries}), retrying...`);
        await page.waitForTimeout(5000 * attempt);
        continue;
      }

      return true;
    } catch (err: any) {
      console.log(`  Navigation failed (attempt ${attempt}/${maxRetries}): ${err.message}`);
      if (attempt < maxRetries) {
        await page.waitForTimeout(3000 * attempt);
      }
    }
  }
  return false;
}

export async function scrapeArticles(handle: string): Promise<Article[]> {
  const browser = await getBrowser();
  const context = await createMobileContext(browser);
  const page = await createStealthPage(context);

  try {
    const cleanHandle = handle.replace('@', '');
    const articlesUrl = `https://x.com/${cleanHandle}/articles`;

    console.log(`Navigating to ${articlesUrl}`);
    const articlesLoaded = await navigateWithRetry(page, articlesUrl);

    if (!articlesLoaded) {
      console.log('Failed to load articles page, trying profile page as fallback...');
      const profileUrl = `https://x.com/${cleanHandle}`;
      const profileLoaded = await navigateWithRetry(page, profileUrl);

      if (!profileLoaded) {
        console.log('Failed to load profile page');
        return [];
      }

      // Try clicking "Articles" tab on profile page
      await page.waitForTimeout(5000);
      try {
        const articlesTab = await page.$('a[href*="/articles"], [role="tab"]:has-text("Articles")');
        if (articlesTab) {
          await articlesTab.click();
          await page.waitForTimeout(5000);
          console.log('Clicked Articles tab on profile');
        } else {
          console.log('Articles tab not found on profile');
          return [];
        }
      } catch {
        console.log('Could not find or click Articles tab');
        return [];
      }
    }

    // Give extra time for content to render
    await page.waitForTimeout(5000);

    // Check for login wall / rate limiting
    const isBlocked = await detectLoginWall(page);
    if (isBlocked) {
      console.log('Blocked by login wall or rate limit after retries');
      return [];
    }

    // Collect all article URLs while scrolling
    console.log('Collecting article URLs...');
    const articleUrls = await collectArticleUrls(page, cleanHandle);
    console.log(`Found ${articleUrls.length} articles`);

    const articles: Article[] = [];
    let consecutiveErrors = 0;

    // Visit each article and extract content with delays to avoid rate limiting
    for (let i = 0; i < articleUrls.length; i++) {
      const url = articleUrls[i];
      console.log(`[${i + 1}/${articleUrls.length}] Scraping ${url}`);

      // Stop if too many consecutive errors (likely rate limited)
      if (consecutiveErrors >= 5) {
        console.log('Too many consecutive errors, stopping to avoid rate limit');
        break;
      }

      try {
        const loaded = await navigateWithRetry(page, url, 2);
        if (!loaded) {
          consecutiveErrors++;
          continue;
        }

        // Wait for React to render content
        try {
          await page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 10000 });
        } catch {
          // Continue anyway
        }
        await page.waitForTimeout(2000);

        const data = await extractArticleContent(page);

        if (data.content.length > 200) {
          articles.push({
            title: data.title,
            content: data.content,
            url,
            views: data.views,
            likes: data.likes,
            score: data.views + data.likes * 10,
            datePosted: data.datePosted,
          });
          console.log(`  OK: ${data.title.slice(0, 50)}... (${data.content.length} chars)`);
          consecutiveErrors = 0;
        } else {
          console.log(`  SKIP: content too short (${data.content.length} chars)`);
        }

        // Add delay between articles to avoid rate limiting
        if (i < articleUrls.length - 1) {
          await page.waitForTimeout(2000 + Math.random() * 1000);
        }
      } catch (err: any) {
        console.log(`  ERROR: ${err.message}`);
        consecutiveErrors++;
        await page.waitForTimeout(3000 + consecutiveErrors * 1000);
      }
    }

    // Sort by score
    articles.sort((a, b) => b.score - a.score);
    console.log(`Total articles scraped: ${articles.length}`);

    return articles;
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
