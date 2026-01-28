/**
 * Boss Office Backend - Server Entry Point
 * Spec: 012-config-secrets
 *
 * Validates configuration at startup and starts Express server
 * Per contracts/startup.yaml: Validation MUST complete before server accepts requests
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import {
  initializeConfiguration,
  logConfigurationState,
  isConfigurationValid,
  getValidationResult
} from './config/config';
import { ConfigurationState } from './config/types';
import { CONFIG_BLOCKING_MESSAGE } from './config/errors';
import healthRouter from './routes/health';
import factoryRouter from './routes/factory';
import jobsRouter from './routes/jobs';
import authRouter from './routes/auth';
import toolResponsesRouter from './routes/toolResponses';
import configGuard from './middleware/configGuard';
import { seedExampleJobs } from './services/jobStore';
import { isLearnWorldsConfigured } from './services/learnworlds';
import { isGitHubConfigured } from './services/github';
import { connectToMongo, closeMongo } from './services/toolDatabase';

// ========== STARTUP VALIDATION ==========

/**
 * Perform startup validation
 * Per contracts/startup.yaml:
 * - Validation MUST be synchronous
 * - Validation MUST complete within 100ms
 * - Server MUST still start even if validation fails
 * - Server MUST block core operations if validation fails
 */
function performStartupValidation(): void {
  const startTime = Date.now();

  console.log('[Startup] Boss Office starting...');
  console.log('[Startup] Validating configuration...');

  // Initialize and validate configuration (synchronous)
  const validationResult = initializeConfiguration();

  const elapsed = Date.now() - startTime;
  console.log(`[Startup] Validation completed in ${elapsed}ms`);

  // Log configuration state (field names only, NEVER values)
  logConfigurationState();

  // Warn if validation took too long (should be < 100ms per spec)
  if (elapsed > 100) {
    console.warn(`[Startup] Warning: Validation took ${elapsed}ms (target: <100ms)`);
  }

  if (validationResult.state === ConfigurationState.CONFIG_ERROR) {
    console.log('[Startup] ================================');
    console.log(`[Startup] ${CONFIG_BLOCKING_MESSAGE}`);
    console.log('[Startup] Core operations will be blocked.');
    console.log('[Startup] ================================');
  }
}

// ========== EXPRESS APP ==========

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:8000', 'http://localhost:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Parse cookies for session management
app.use(cookieParser());

// ========== ROUTES ==========

// Health endpoint - MUST be available even in CONFIG_ERROR state (no configGuard)
app.use('/api', healthRouter);

// Auth routes - LearnWorlds SSO integration
app.use('/api/auth', authRouter);

// Jobs routes - for Boss Office app
app.use('/api/boss/jobs', jobsRouter);

// Factory routes - protected by configGuard for core operations
app.use('/api/factory', factoryRouter);

// Tool responses - MongoDB storage with LearnWorlds auth
app.use('/api/tools', toolResponsesRouter);

// Root endpoint - always available
app.get('/', (req, res) => {
  res.json({
    service: 'Boss Office API',
    version: '1.0.0',
    config_state: isConfigurationValid() ? 'VALID' : 'CONFIG_ERROR',
    integrations: {
      learnworlds: isLearnWorldsConfigured(),
      github: isGitHubConfigured()
    }
  });
});

// ========== SERVER STARTUP ==========

/**
 * Start the server
 * Per contracts/startup.yaml:
 * - Server MUST still start even in CONFIG_ERROR state
 * - Health endpoint MUST be available
 */
async function startServer(): Promise<void> {
  // Step 1: Validate configuration BEFORE accepting requests
  performStartupValidation();

  // Step 2: Seed example jobs for demo purposes
  seedExampleJobs();

  // Step 3: Connect to MongoDB if URI is configured
  if (process.env.MONGODB_URI) {
    try {
      await connectToMongo();
      console.log('[Startup] MongoDB connected for tool responses');
    } catch (error) {
      console.warn('[Startup] MongoDB connection failed:', (error as Error).message);
      console.warn('[Startup] Tool response storage will not be available');
    }
  } else {
    console.log('[Startup] MONGODB_URI not configured - tool response storage disabled');
  }

  // Step 4: Start HTTP server (even in CONFIG_ERROR state)
  const server = app.listen(PORT, () => {
    console.log(`[Startup] Server running on port ${PORT}`);

    if (!isConfigurationValid()) {
      console.log('[Startup] WARNING: Server is running but core operations are BLOCKED');
      console.log('[Startup] Fix configuration and restart to enable operations');
    } else {
      console.log('[Startup] All systems operational');
    }
  });

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('[Shutdown] Graceful shutdown initiated...');
    await closeMongo();
    server.close(() => {
      console.log('[Shutdown] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Start the server
startServer();

export default app;
