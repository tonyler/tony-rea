import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  // Approach 1: Try oembed API (no auth needed)
  console.log('=== Approach 1: oembed API ===');
  try {
    const oembedUrl = 'https://publish.twitter.com/oembed?url=https://x.com/tonyler_/status/2020797517978329554';
    const resp = await fetch(oembedUrl);
    const data = await resp.json();
    console.log('oembed response:', JSON.stringify(data, null, 2).slice(0, 500));
  } catch (err: any) {
    console.log('oembed failed:', err.message);
  }

  // Approach 2: Use GraphQL API with cookie auth
  console.log('\n=== Approach 2: GraphQL TweetDetail API ===');
  const cookiesData = fs.readFileSync(path.join(process.cwd(), '..', 'x.com_cookies.json'), 'utf-8');
  const rawCookies = JSON.parse(cookiesData);

  // Extract needed cookies
  const getCookie = (name: string) => rawCookies.find((c: any) => c.name === name)?.value || '';
  const csrfToken = getCookie('ct0');
  const authToken = getCookie('auth_token');

  console.log('CSRF token:', csrfToken ? csrfToken.slice(0, 20) + '...' : 'MISSING');
  console.log('Auth token:', authToken ? authToken.slice(0, 10) + '...' : 'MISSING');

  if (csrfToken && authToken) {
    // Build cookie string
    const cookieStr = rawCookies
      .filter((c: any) => c.name && c.value)
      .map((c: any) => `${c.name}=${c.value}`)
      .join('; ');

    const tweetId = '2020797517978329554';

    // TweetResultByRestId GraphQL endpoint
    const variables = JSON.stringify({
      tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: false,
    });
    const features = JSON.stringify({
      creator_subscriptions_tweet_preview_api_enabled: true,
      communities_web_enable_tweet_community_results_fetch: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      articles_preview_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      tweet_awards_web_tipping_enabled: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      rweb_video_timestamps_enabled: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false,
    });

    const graphqlUrl = `https://x.com/i/api/graphql/xOhkmRac04YFZmOzU9PJHg/TweetResultByRestId?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

    try {
      const resp = await fetch(graphqlUrl, {
        headers: {
          'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
          'x-csrf-token': csrfToken,
          'cookie': cookieStr,
          'content-type': 'application/json',
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-client-language': 'en',
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });

      console.log('Status:', resp.status);
      const data = await resp.json();

      // Navigate to tweet result
      const tweet = data?.data?.tweetResult?.result;
      if (tweet) {
        console.log('Tweet type:', tweet.__typename);
        const legacy = tweet.legacy || tweet.tweet?.legacy;
        if (legacy) {
          console.log('Full text:', legacy.full_text?.slice(0, 300));
          console.log('Retweet count:', legacy.retweet_count);
          console.log('Favorite count:', legacy.favorite_count);
        }

        // Check for article/note content
        const noteTweet = tweet.note_tweet || tweet.tweet?.note_tweet;
        if (noteTweet) {
          console.log('\nNote tweet text:', noteTweet.note_tweet_results?.result?.text?.slice(0, 500));
        }

        // Check for article content in card
        const card = tweet.card || tweet.tweet?.card;
        if (card) {
          console.log('\nCard:', JSON.stringify(card, null, 2).slice(0, 1000));
        }

        // Check for twitter article
        const article = tweet.article || tweet.tweet?.article;
        if (article) {
          console.log('\nArticle:', JSON.stringify(article, null, 2).slice(0, 1000));
        }

        // Dump full tweet structure keys
        console.log('\nTweet keys:', Object.keys(tweet));
        if (tweet.tweet) console.log('Inner tweet keys:', Object.keys(tweet.tweet));

        // Dump full response (truncated)
        console.log('\nFull response (truncated):', JSON.stringify(data, null, 2).slice(0, 3000));
      } else {
        console.log('No tweet result found');
        console.log('Response:', JSON.stringify(data, null, 2).slice(0, 1000));
      }
    } catch (err: any) {
      console.log('GraphQL failed:', err.message);
    }
  }

  // Approach 3: Intercept API on article click in browser
  console.log('\n=== Approach 3: Intercept API on card click ===');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US',
  });

  const playwrightCookies = rawCookies.filter((c: any) => c.name && c.value).map((c: any) => ({
    name: c.name, value: c.value, domain: c.domain, path: c.path || '/',
    expires: c.expirationDate || -1, httpOnly: c.httpOnly || false,
    secure: c.secure || false, sameSite: 'Lax' as const,
  }));
  await context.addCookies(playwrightCookies);

  const page = await context.newPage();
  await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  await page.goto('https://x.com/tonyler_/articles', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Intercept ALL requests with response data
  const allRequests: { url: string; status: number; bodyPreview: string }[] = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('graphql') || url.includes('/api/')) {
      try {
        const body = await resp.text();
        allRequests.push({
          url: url.slice(0, 200),
          status: resp.status(),
          bodyPreview: body.slice(0, 300),
        });
      } catch {
        allRequests.push({ url: url.slice(0, 200), status: resp.status(), bodyPreview: '[error reading body]' });
      }
    }
  });

  // Click the first card's text area
  const firstCard = page.locator('[data-testid="tweet"]').first();
  await firstCard.click({ position: { x: 200, y: 50 } });
  await page.waitForTimeout(10000);

  console.log('URL after card click:', page.url());

  console.log('\nIntercepted responses:');
  for (const req of allRequests) {
    console.log(`  ${req.status} ${req.url}`);
    if (req.bodyPreview.includes('article') || req.bodyPreview.includes('Article') || req.url.includes('TweetDetail')) {
      console.log(`    Body: ${req.bodyPreview.slice(0, 200)}`);
    }
  }

  await context.close();
  await browser.close();
  console.log('\nDone.');
})();
