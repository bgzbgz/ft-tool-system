/**
 * Authentication Routes
 * Handles LearnWorlds SSO callbacks and session management
 */

import { Router, Request, Response } from 'express';
import {
  validateSSOToken,
  parseWebhookPayload,
  verifyWebhookSignature,
  getLearnWorldsUser,
  isLearnWorldsConfigured,
  learnWorldsAuth,
  LearnWorldsUser
} from '../services/learnworlds';

const router = Router();

// ========== SSO CALLBACK ==========

/**
 * GET /api/auth/learnworlds/callback
 * SSO callback endpoint - LearnWorlds redirects here with token
 *
 * Query params:
 * - token: SSO JWT token
 * - redirect: Optional URL to redirect after auth
 */
router.get('/learnworlds/callback', async (req: Request, res: Response) => {
  const { token, redirect } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      error: 'Missing token parameter',
      code: 'MISSING_TOKEN'
    });
  }

  // Validate token
  const result = await validateSSOToken(token);

  if (!result.valid || !result.user) {
    return res.status(401).json({
      error: result.error || 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }

  // Set session cookie
  res.cookie('lw_sso_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  // Store user info in non-httpOnly cookie for frontend
  res.cookie('lw_user', JSON.stringify({
    id: result.user.id,
    email: result.user.email,
    name: `${result.user.first_name || ''} ${result.user.last_name || ''}`.trim(),
    role: result.user.role
  }), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  console.log(`[Auth] User authenticated: ${result.user.email} (${result.user.role})`);

  // Redirect to app or specified URL
  const redirectUrl = typeof redirect === 'string' ? redirect : '/';
  res.redirect(redirectUrl);
});

/**
 * POST /api/auth/learnworlds/callback
 * Alternative callback for POST-based SSO
 */
router.post('/learnworlds/callback', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({
      error: 'Missing token in body',
      code: 'MISSING_TOKEN'
    });
  }

  const result = await validateSSOToken(token);

  if (!result.valid || !result.user) {
    return res.status(401).json({
      error: result.error || 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }

  // Set cookies
  res.cookie('lw_sso_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  console.log(`[Auth] User authenticated via POST: ${result.user.email}`);

  res.json({
    success: true,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: `${result.user.first_name || ''} ${result.user.last_name || ''}`.trim(),
      role: result.user.role
    }
  });
});

// ========== SESSION MANAGEMENT ==========

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', learnWorldsAuth({ required: false }), (req: Request, res: Response) => {
  if (!req.lwUser) {
    return res.status(401).json({
      authenticated: false,
      error: 'Not authenticated'
    });
  }

  res.json({
    authenticated: true,
    user: {
      id: req.lwUser.id,
      email: req.lwUser.email,
      name: `${req.lwUser.first_name || ''} ${req.lwUser.last_name || ''}`.trim(),
      role: req.lwUser.role,
      tags: req.lwUser.tags
    }
  });
});

/**
 * POST /api/auth/logout
 * Clear session cookies
 */
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('lw_sso_token');
  res.clearCookie('lw_user');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * GET /api/auth/status
 * Check auth configuration status
 */
router.get('/status', (req: Request, res: Response) => {
  res.json({
    configured: isLearnWorldsConfigured(),
    provider: 'learnworlds',
    sso_endpoint: '/api/auth/learnworlds/callback'
  });
});

// ========== LEARNWORLDS WEBHOOKS ==========

/**
 * POST /api/auth/learnworlds/webhook
 * Receive webhooks from LearnWorlds
 *
 * Events:
 * - user.created: New user registered
 * - user.enrolled: User enrolled in course
 * - course.completed: User completed course
 */
router.post('/learnworlds/webhook', async (req: Request, res: Response) => {
  // Verify signature
  const signature = req.headers['x-lw-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (signature && !verifyWebhookSignature(rawBody, signature)) {
    console.log('[Auth] Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse payload
  const payload = parseWebhookPayload(req.body);

  if (!payload) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  console.log(`[Auth] Webhook received: ${payload.event}`);

  // Handle different events
  switch (payload.event) {
    case 'user.created':
      console.log(`[Auth] New user created: ${payload.data.email}`);
      // Could auto-provision user in your system
      break;

    case 'user.enrolled':
      console.log(`[Auth] User ${payload.data.user_id} enrolled in ${payload.data.course_id}`);
      // Could unlock features based on course enrollment
      break;

    case 'course.completed':
      console.log(`[Auth] User ${payload.data.user_id} completed ${payload.data.course_id}`);
      // Could trigger certificate generation, etc.
      break;

    default:
      console.log(`[Auth] Unhandled event: ${payload.event}`);
  }

  // Always acknowledge webhook
  res.json({ received: true, event: payload.event });
});

// ========== SSO LINK GENERATION ==========

/**
 * GET /api/auth/sso-link
 * Generate SSO link for LearnWorlds (for embedding tools)
 *
 * Query params:
 * - return_url: URL to return to after auth
 */
router.get('/sso-link', (req: Request, res: Response) => {
  const { return_url } = req.query;

  const schoolId = process.env.LEARNWORLDS_SCHOOL_ID;
  const clientId = process.env.LEARNWORLDS_CLIENT_ID;

  if (!schoolId || !clientId) {
    return res.status(503).json({
      error: 'SSO not configured',
      code: 'SSO_NOT_CONFIGURED'
    });
  }

  // Build LearnWorlds SSO URL
  const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/learnworlds/callback`;
  const redirectParam = return_url ? `&redirect=${encodeURIComponent(return_url as string)}` : '';

  const ssoUrl = `https://${schoolId}.learnworlds.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    redirectParam;

  res.json({
    sso_url: ssoUrl,
    callback_url: callbackUrl
  });
});

export default router;
