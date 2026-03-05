import { scrapeArticles, closeBrowser } from './src/services/x-scraper';

async function main() {
  const handle = 'tonyler_';
  console.log(`Starting full scrape for @${handle}...`);
  console.time('scrape');

  try {
    const articles = await scrapeArticles(handle);
    console.timeEnd('scrape');

    console.log(`\n=== RESULTS ===`);
    console.log(`Total articles: ${articles.length}`);
    articles.forEach((a, i) => {
      console.log(`\n[${i + 1}] ${a.title}`);
      console.log(`    URL: ${a.url}`);
      console.log(`    Content: ${a.content.length} chars`);
      console.log(`    Views: ${a.views}, Likes: ${a.likes}, Score: ${a.score}`);
      console.log(`    Date: ${a.datePosted}`);
    });
  } catch (err: any) {
    console.error(`Failed: ${err.message}`);
  } finally {
    await closeBrowser();
  }
}

main();
