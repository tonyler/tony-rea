import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { initializeLLM } from './services/llm';
import { initializeStorage } from './services/storage';
import { env, appConfig } from './config';

const app = express();

// Middleware
app.use(cors({
  origin: true, // Allow same-origin in development
  credentials: true,
}));

app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import routes (will be created next)
import assistantRoutes from './routes/assistant';
import feedRoutes from './routes/feed';
import threadsRoutes from './routes/threads';
import projectsRoutes from './routes/projects';
import tagsRoutes from './routes/tags';

// Register routes
app.use('/api/assistant', assistantRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tags', tagsRoutes);

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
    initializeLLM(env.OPENAI_API_KEY);
    await initializeStorage();

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
