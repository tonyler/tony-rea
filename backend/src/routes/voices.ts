import { Router } from 'express';
import {
  getExampleArticles,
  getAllArticles,
  refreshArticles,
  listVoiceSummaries,
  getVoiceSummary,
  analyzeVoiceProfile,
  getVoiceProfileMeta,
} from '../services/voice-analyzer';

const router = Router();

// GET /api/voices - List all cached voices with summaries
router.get('/', async (_req, res, next) => {
  try {
    const voices = await listVoiceSummaries();
    res.json({ voices });
  } catch (error) {
    next(error);
  }
});

// GET /api/voices/:handle - Get voice summary and top articles
router.get('/:handle', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    const summary = await getVoiceSummary(handle);

    if (!summary) {
      res.status(404).json({ error: `No cached articles for @${handle}` });
      return;
    }

    const articles = await getExampleArticles(handle);
    res.json({ ...summary, articles });
  } catch (error) {
    next(error);
  }
});

// GET /api/voices/:handle/all - Get all cached articles (not just top 10)
router.get('/:handle/all', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    const articles = await getAllArticles(handle);
    res.json({ handle, articles, count: articles.length });
  } catch (error) {
    next(error);
  }
});

// GET /api/voices/:handle/profile - Get voice profile
router.get('/:handle/profile', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    const meta = await getVoiceProfileMeta(handle);

    if (!meta) {
      res.status(404).json({ error: `No voice profile for @${handle}. Run POST /:handle/analyze first.` });
      return;
    }

    res.json(meta);
  } catch (error) {
    next(error);
  }
});

// POST /api/voices/:handle/analyze - Analyze voice profile (without re-scraping)
router.post('/:handle/analyze', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    console.log(`[voices] POST /${handle}/analyze - starting voice profile analysis`);

    await analyzeVoiceProfile(handle);
    const meta = await getVoiceProfileMeta(handle);

    res.json(meta);
  } catch (error) {
    next(error);
  }
});

// POST /api/voices/:handle/refresh - Scrape articles from X
router.post('/:handle/refresh', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    const articles = await refreshArticles(handle);
    const summary = await getVoiceSummary(handle);

    // Trigger voice profile analysis (non-fatal)
    try {
      await analyzeVoiceProfile(handle);
      console.log(`[voices] Voice profile analysis complete for @${handle}`);
    } catch (profileError) {
      console.warn(`[voices] Voice profile analysis failed for @${handle}:`, profileError instanceof Error ? profileError.message : profileError);
    }

    // Re-fetch summary to get updated has_profile flag
    const updatedSummary = await getVoiceSummary(handle);

    res.json({
      ...updatedSummary,
      articles: articles.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
