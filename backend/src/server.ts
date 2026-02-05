import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { requireAuth } from './middleware/auth';
import { initializeLLM } from './services/llm';
import { initializeStorage } from './services/storage';
import { cleanExpiredSessions, initializeSessions } from './services/session';
import { initializeProviders } from './services/multi-llm';
import { env, appConfig } from './config';

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes
import authRoutes from './routes/auth';
import assistantRoutes from './routes/assistant';
import feedRoutes from './routes/feed';
import threadsRoutes from './routes/threads';
import projectsRoutes from './routes/projects';
import tagsRoutes from './routes/tags';
import articlesRoutes from './routes/articles';
import voicesRoutes from './routes/voices';

// Register auth routes (no auth required)
app.use('/api/auth', authRoutes);

// Register protected routes (auth required)
app.use('/api/assistant', requireAuth, assistantRoutes);
app.use('/api/feed', requireAuth, feedRoutes);
app.use('/api/threads', requireAuth, threadsRoutes);
app.use('/api/projects', requireAuth, projectsRoutes);
app.use('/api/tags', requireAuth, tagsRoutes);
app.use('/api/articles', requireAuth, articlesRoutes);
app.use('/api/voices', requireAuth, voicesRoutes);

// Serve frontend static files in production
if (appConfig.isProduction) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Initialize services
    initializeProviders();  // Multi-LLM (Perplexity, Anthropic, xAI)
    if (env.OPENAI_API_KEY) {
      initializeLLM(env.OPENAI_API_KEY);  // Legacy OpenAI for feed/assistant features
    }
    await initializeStorage();
    await initializeSessions();

    // Clean expired sessions on startup
    await cleanExpiredSessions();

    // Start server
    app.listen(appConfig.port, () => {
      console.log(`Server running on port ${appConfig.port}`);
      console.log(`Environment: ${appConfig.nodeEnv}`);
      console.log(`Health check: http://localhost:${appConfig.port}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
