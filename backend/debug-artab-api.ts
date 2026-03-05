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

  // Intercept responses and save large ones
  const apiResponses: { url: string; status: number; headers: Record<string, string>; body: string }[] = [];

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('graphql') && !url.includes('error_log') && !url.includes('user_flow') && !url.includes('ces/')) {
      try {
        const body = await resp.text();
        const headers: Record<string, string> = {};
        for (const [key, value] of resp.headers()) {
          if (key.startsWith('x-rate-limit') || key === 'content-type') {
            headers[key] = value;
          }
        }
        apiResponses.push({ url: url.slice(0, 300), status: resp.status(), headers, body });
      } catch { /* ignore */ }
    }
  });

  console.log('Loading articles tab...');
  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);

  console.log(`Intercepted ${apiResponses.length} GraphQL responses`);

  for (const resp of apiResponses) {
    console.log(`\n=== ${resp.status} ${resp.url.slice(0, 150)} ===`);
    console.log('Headers:', JSON.stringify(resp.headers));

    if (resp.status === 200 && resp.body.length > 100) {
      try {
        const data = JSON.parse(resp.body);

        // Save full response to file for analysis
        const filename = `/tmp/x-api-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`Saved full response to ${filename} (${resp.body.length} chars)`);

        // Try to find article/tweet content in the response
        const findArticles = (obj: any, depth = 0, path = ''): void => {
          if (depth > 15 || !obj) return;
          if (typeof obj === 'string' && obj.length > 200) {
            // Found a long text string
            console.log(`  Text at ${path}: ${obj.slice(0, 150)}...`);
          }
          if (obj?.note_tweet_results) {
            const text = obj.note_tweet_results?.result?.text;
            if (text) {
              console.log(`  NOTE TWEET at ${path}: ${text.slice(0, 300)}...`);
            }
          }
          if (obj?.twitter_article) {
            console.log(`  TWITTER ARTICLE at ${path}:`, JSON.stringify(obj.twitter_article).slice(0, 500));
          }
          if (obj?.article) {
            console.log(`  ARTICLE at ${path}:`, JSON.stringify(obj.article).slice(0, 500));
          }
          if (obj?.full_text && typeof obj.full_text === 'string') {
            console.log(`  FULL_TEXT at ${path}: ${obj.full_text.slice(0, 200)}`);
          }
          if (typeof obj === 'object') {
            const keys = Object.keys(obj);
            for (const key of keys) {
              findArticles(obj[key], depth + 1, `${path}.${key}`);
            }
          }
          if (Array.isArray(obj)) {
            for (let i = 0; i < Math.min(obj.length, 50); i++) {
              findArticles(obj[i], depth + 1, `${path}[${i}]`);
            }
          }
        };

        findArticles(data);
      } catch {
        console.log('Body (not JSON):', resp.body.slice(0, 200));
      }
    }
  }

  // Scroll and capture more responses
  console.log('\n\nScrolling to load more articles...');
  apiResponses.length = 0;

  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(2000);
  }

  console.log(`Intercepted ${apiResponses.length} more GraphQL responses during scroll`);
  for (const resp of apiResponses) {
    console.log(`  ${resp.status} ${resp.url.slice(0, 150)} (${resp.body.length} chars)`);
    if (resp.status === 200 && resp.body.length > 100) {
      const filename = `/tmp/x-api-scroll-${Date.now()}.json`;
      fs.writeFileSync(filename, resp.body);
      console.log(`  Saved to ${filename}`);
    }
  }

  // Also check rate limit headers for TweetDetail
  console.log('\n\nChecking TweetDetail rate limit status...');
  const cookies = rawCookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
  const csrfToken = rawCookies.find((c: any) => c.name === 'ct0')?.value || '';

  try {
    const resp = await fetch('https://x.com/i/api/graphql/ooUbmy0T2DmvwfjgARktiQ/TweetDetail?variables=%7B%22focalTweetId%22%3A%222020797517978329554%22%7D&features=%7B%7D', {
      headers: {
        'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
        'x-csrf-token': csrfToken,
        'cookie': cookies,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
      },
    });

    console.log('Status:', resp.status);
    for (const [key, value] of resp.headers) {
      if (key.startsWith('x-rate-limit')) {
        console.log(`  ${key}: ${value}`);
        if (key === 'x-rate-limit-reset') {
          const resetTime = new Date(parseInt(value) * 1000);
          console.log(`  Reset at: ${resetTime.toISOString()} (in ${Math.round((resetTime.getTime() - Date.now()) / 1000)}s)`);
        }
      }
    }
  } catch (err: any) {
    console.log('Failed:', err.message);
  }

  await context.close();
  await browser.close();
  console.log('\nDone.');
})();
