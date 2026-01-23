import { Router } from 'express';
import {
  getAllTags,
  loadUserTags,
  loadPendingTags,
  addPendingTag,
  acceptPendingTag,
  rejectPendingTag,
  removeUserTag,
  BASE_PREDEFINED_TAGS,
  PendingTag,
} from '../config/tags';
import { createError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/tags
 * Get all tags (predefined + user-added)
 */
router.get('/', (req, res) => {
  const allTags = getAllTags();
  const userTags = loadUserTags();
  const pendingTags = loadPendingTags();

  res.json({
    tags: allTags,
    counts: {
      total: allTags.length,
      predefined: BASE_PREDEFINED_TAGS.length,
      userAdded: userTags.length,
      pending: pendingTags.length,
    },
  });
});

/**
 * GET /api/tags/predefined
 * Get only base predefined tags
 */
router.get('/predefined', (req, res) => {
  res.json({
    tags: [...BASE_PREDEFINED_TAGS],
    count: BASE_PREDEFINED_TAGS.length,
  });
});

/**
 * GET /api/tags/user
 * Get user-added tags
 */
router.get('/user', (req, res) => {
  const userTags = loadUserTags();
  res.json({
    tags: userTags,
    count: userTags.length,
  });
});

/**
 * GET /api/tags/pending
 * Get pending (proposed) tags awaiting review
 */
router.get('/pending', (req, res) => {
  const pendingTags = loadPendingTags();
  res.json({
    tags: pendingTags,
    count: pendingTags.length,
  });
});

/**
 * POST /api/tags/propose
 * Propose a new tag (goes to pending for review)
 * Body: { tag: string }
 */
router.post('/propose', (req, res, next) => {
  try {
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      throw createError('tag is required', 400);
    }

    const trimmedTag = tag.trim();

    // Check if already in active tags
    const allTags = getAllTags();
    if (allTags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
      throw createError('Tag already exists in active tags', 400);
    }

    // Add to pending
    addPendingTag(trimmedTag, 'user');

    res.status(201).json({
      message: 'Tag proposed successfully',
      tag: trimmedTag,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/accept
 * Accept a pending tag (moves to user tags)
 * Body: { tag: string }
 */
router.post('/accept', (req, res, next) => {
  try {
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string') {
      throw createError('tag is required', 400);
    }

    const success = acceptPendingTag(tag.trim());

    if (success) {
      res.json({
        message: 'Tag accepted and added to active tags',
        tag: tag.trim(),
      });
    } else {
      throw createError('Failed to accept tag', 500);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/reject
 * Reject a pending tag (removes from pending)
 * Body: { tag: string }
 */
router.post('/reject', (req, res, next) => {
  try {
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string') {
      throw createError('tag is required', 400);
    }

    const success = rejectPendingTag(tag.trim());

    if (success) {
      res.json({
        message: 'Tag rejected and removed from pending',
        tag: tag.trim(),
      });
    } else {
      throw createError('Tag not found in pending list', 404);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/add
 * Directly add a new user tag (bypasses pending)
 * Body: { tag: string }
 */
router.post('/add', (req, res, next) => {
  try {
    const { tag } = req.body;

    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      throw createError('tag is required', 400);
    }

    const trimmedTag = tag.trim();

    // Check if already exists
    const allTags = getAllTags();
    if (allTags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
      throw createError('Tag already exists', 400);
    }

    // Add directly (acceptPendingTag handles both pending and direct adds)
    acceptPendingTag(trimmedTag);

    res.status(201).json({
      message: 'Tag added successfully',
      tag: trimmedTag,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tags/user/:tag
 * Remove a user-added tag
 */
router.delete('/user/:tag', (req, res, next) => {
  try {
    const { tag } = req.params;

    if (!tag) {
      throw createError('tag is required', 400);
    }

    // Check if it's a base predefined tag (can't delete those)
    if (BASE_PREDEFINED_TAGS.some(t => t.toLowerCase() === tag.toLowerCase())) {
      throw createError('Cannot delete predefined tags', 400);
    }

    const success = removeUserTag(tag);

    if (success) {
      res.json({
        message: 'Tag removed successfully',
        tag,
      });
    } else {
      throw createError('Tag not found in user tags', 404);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/accept-all
 * Accept all pending tags at once
 */
router.post('/accept-all', (req, res, next) => {
  try {
    const pendingTags = loadPendingTags();
    const accepted: string[] = [];

    for (const pending of pendingTags) {
      acceptPendingTag(pending.tag);
      accepted.push(pending.tag);
    }

    res.json({
      message: `Accepted ${accepted.length} tags`,
      tags: accepted,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tags/reject-all
 * Reject all pending tags at once
 */
router.post('/reject-all', (req, res, next) => {
  try {
    const pendingTags = loadPendingTags();
    const rejected: string[] = [];

    for (const pending of pendingTags) {
      rejectPendingTag(pending.tag);
      rejected.push(pending.tag);
    }

    res.json({
      message: `Rejected ${rejected.length} tags`,
      tags: rejected,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
