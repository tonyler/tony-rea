import * as fs from 'fs';
import * as path from 'path';

(async () => {
  const cookiesData = fs.readFileSync(path.join(process.cwd(), '..', 'x.com_cookies.json'), 'utf-8');
  const rawCookies = JSON.parse(cookiesData);
  const cookieStr = rawCookies.filter((c: any) => c.name && c.value).map((c: any) => `${c.name}=${c.value}`).join('; ');
  const csrfToken = rawCookies.find((c: any) => c.name === 'ct0')?.value || '';

  const headers = {
    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    'x-csrf-token': csrfToken,
    'cookie': cookieStr,
    'content-type': 'application/json',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  };

  const tweetId = '2020797517978329554';

  const variables = {
    focalTweetId: tweetId,
    referrer: 'profile',
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  };

  const features = {
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
  };

  const url = `https://x.com/i/api/graphql/ooUbmy0T2DmvwfjgARktiQ/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

  console.log('Fetching TweetDetail for', tweetId);
  const resp = await fetch(url, { headers });
  console.log('Status:', resp.status);

  // Rate limit info
  for (const [key, value] of resp.headers) {
    if (key.startsWith('x-rate-limit')) {
      console.log(`  ${key}: ${value}`);
    }
  }

  if (resp.status !== 200) {
    const text = await resp.text();
    console.log('Error:', text.slice(0, 500));
    return;
  }

  const data = await resp.json();
  fs.writeFileSync('/tmp/tweet-detail-full.json', JSON.stringify(data, null, 2));
  console.log('Full response saved to /tmp/tweet-detail-full.json');

  // Navigate the response to find article content
  const instructions = data?.data?.threaded_conversation_with_injections_v2?.instructions;
  if (!instructions) {
    console.log('No instructions found');
    console.log('Top keys:', Object.keys(data?.data || {}));
    return;
  }

  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') continue;

    for (const entry of instruction.entries || []) {
      const result = entry?.content?.itemContent?.tweet_results?.result;
      if (!result) continue;

      const tweet = result.__typename === 'TweetWithVisibilityResults' ? result.tweet : result;
      if (!tweet) continue;

      const legacy = tweet.legacy;
      console.log('\n--- Tweet ---');
      console.log('ID:', tweet.rest_id);
      console.log('Full text:', legacy?.full_text?.slice(0, 200));

      // Check note_tweet (long tweet)
      if (tweet.note_tweet) {
        const noteText = tweet.note_tweet?.note_tweet_results?.result?.text;
        console.log('NOTE TEXT:', noteText?.slice(0, 500));
      }

      // Check for twitter article
      if (tweet.twitter_article) {
        console.log('TWITTER ARTICLE:', JSON.stringify(tweet.twitter_article, null, 2).slice(0, 2000));
      }

      // Check card
      if (tweet.card) {
        const cardLegacy = tweet.card.legacy;
        console.log('CARD name:', cardLegacy?.name);
        if (cardLegacy?.binding_values) {
          for (const bv of cardLegacy.binding_values) {
            if (bv.value?.string_value && bv.value.string_value.length > 50) {
              console.log(`  Card ${bv.key}: ${bv.value.string_value.slice(0, 200)}`);
            }
          }
        }
      }

      // Check all top-level keys for article hints
      for (const key of Object.keys(tweet)) {
        if (key.includes('article') || key.includes('Article') || key.includes('longform') || key.includes('note')) {
          console.log(`  Key ${key}:`, JSON.stringify(tweet[key], null, 2).slice(0, 500));
        }
      }
    }
  }

  // Try second article too
  console.log('\n\n=== Second article ===');
  const tweetId2 = '2019371596301910243';
  const variables2 = { ...variables, focalTweetId: tweetId2 };
  const url2 = `https://x.com/i/api/graphql/ooUbmy0T2DmvwfjgARktiQ/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables2))}&features=${encodeURIComponent(JSON.stringify(features))}`;

  const resp2 = await fetch(url2, { headers });
  console.log('Status:', resp2.status);

  if (resp2.status === 200) {
    const data2 = await resp2.json();
    fs.writeFileSync('/tmp/tweet-detail-2.json', JSON.stringify(data2, null, 2));
    console.log('Saved to /tmp/tweet-detail-2.json');

    const instructions2 = data2?.data?.threaded_conversation_with_injections_v2?.instructions;
    for (const instruction of instructions2 || []) {
      if (instruction.type !== 'TimelineAddEntries') continue;
      for (const entry of instruction.entries || []) {
        const result = entry?.content?.itemContent?.tweet_results?.result;
        if (!result) continue;
        const tweet = result.__typename === 'TweetWithVisibilityResults' ? result.tweet : result;
        if (!tweet) continue;
        console.log('ID:', tweet.rest_id);
        console.log('Full text:', tweet.legacy?.full_text?.slice(0, 200));
        if (tweet.note_tweet) console.log('NOTE:', tweet.note_tweet?.note_tweet_results?.result?.text?.slice(0, 500));
        if (tweet.twitter_article) console.log('ARTICLE:', JSON.stringify(tweet.twitter_article).slice(0, 500));

        // Dump all keys
        console.log('Keys:', Object.keys(tweet).join(', '));
      }
    }
  }

  console.log('\nDone.');
})();
