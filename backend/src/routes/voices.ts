import { Router } from 'express';
import {
  getExampleArticles,
  getAllArticles,
  refreshArticles,
  listVoiceSummaries,
  getVoiceSummary,
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

// POST /api/voices/:handle/refresh - Scrape articles from X
router.post('/:handle/refresh', async (req, res, next) => {
  try {
    const handle = req.params.handle;
    const articles = await refreshArticles(handle);
    const summary = await getVoiceSummary(handle);

    res.json({
      ...summary,
      articles: articles.slice(0, 10), // Return top 10
    });
  } catch (error) {
    next(error);
  }
});

export default router;
