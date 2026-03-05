import { refreshArticles } from './src/services/voice-analyzer';
import { analyzeVoiceProfile } from './src/services/voice-analyzer';
import { closeBrowser } from './src/services/x-scraper';

async function main() {
  const handle = 'tonyler_';

  try {
    // Step 1: Scrape and cache articles
    console.log('=== STEP 1: Scrape & Cache ===');
    console.time('scrape');
    const articles = await refreshArticles(handle);
    console.timeEnd('scrape');
    console.log(`Cached ${articles.length} articles\n`);

    // Step 2: Analyze voice profile
    console.log('=== STEP 2: Analyze Voice Profile ===');
    console.time('analyze');
    const profile = await analyzeVoiceProfile(handle);
    console.timeEnd('analyze');
    console.log(`\nProfile generated:`);
    console.log(JSON.stringify(profile, null, 2));

  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
    console.error(err.stack);
  } finally {
    await closeBrowser();
  }
}

main();
