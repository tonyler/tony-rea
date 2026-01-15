import { Router } from 'express';
import { createProject, listProjects, getProject } from '../services/storage';
import { createError } from '../middleware/error-handler';

const router = Router();

// GET /api/projects - List all projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await listProjects();
    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string') {
      throw createError('Project name is required', 400);
    }

    const project = await createProject(name, description);
    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof Error && error.message === 'Project already exists') {
      next(createError('Project already exists', 409));
    } else {
      next(error);
    }
  }
});

// GET /api/projects/:id - Get project details
router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);

    if (!project) {
      throw createError('Project not found', 404);
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

export default router;
