/**
 * Tool Responses Routes
 * Handles storing and retrieving tool responses with LearnWorlds authentication
 *
 * Flow:
 * 1. Tool HTML form submits to this API
 * 2. LearnWorlds token is validated
 * 3. Response is stored in tool's MongoDB collection
 * 4. Verdict and response_id returned to tool
 */

import { Router, Request, Response } from 'express';
import {
  validateSSOToken,
  learnWorldsAuth,
  LearnWorldsUser
} from '../services/learnworlds';
import {
  storeToolResponse,
  updateCommitment,
  getToolMetadata,
  getToolResponses,
  getToolAnalytics,
  getUserResponseHistory,
  listToolCollections
} from '../services/toolDatabase';
import { LearnWorldsUserInfo } from '../models/toolCollection';

const router = Router();

// ========== TOOL RESPONSE SUBMISSION ==========

/**
 * POST /api/tools/:tool_slug/responses
 * Submit a tool response
 *
 * Body:
 * - lw_token: LearnWorlds SSO token (required)
 * - session_id: Browser session ID
 * - client_info: { name, company, email, ... }
 * - inputs: { field_name: value, ... }
 * - score: Calculated score
 * - started_at: ISO timestamp when user started
 *
 * Headers:
 * - Authorization: Bearer <lw_token> (alternative to body)
 */
router.post('/:tool_slug/responses', async (req: Request, res: Response) => {
  const { tool_slug } = req.params;
  const {
    lw_token,
    session_id,
    client_info,
    inputs,
    score,
    started_at,
    context
  } = req.body;

  // Get token from body or Authorization header
  const token = lw_token ||
    req.headers.authorization?.replace('Bearer ', '') ||
    req.cookies?.lw_sso_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please log in to LearnWorlds to save your results',
      code: 'AUTH_REQUIRED'
    });
  }

  // Validate LearnWorlds token
  const authResult = await validateSSOToken(token);

  if (!authResult.valid || !authResult.user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication',
      message: authResult.error || 'Your session has expired. Please log in again.',
      code: 'AUTH_INVALID'
    });
  }

  // Validate required fields
  if (!session_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing session_id',
      code: 'MISSING_SESSION'
    });
  }

  if (typeof score !== 'number' && score !== undefined) {
    return res.status(400).json({
      success: false,
      error: 'Score must be a number',
      code: 'INVALID_SCORE'
    });
  }

  // Build LearnWorlds user info
  const lwUser = authResult.user;
  const user: LearnWorldsUserInfo = {
    user_id: lwUser.id,
    email: lwUser.email,
    first_name: lwUser.first_name,
    last_name: lwUser.last_name,
    role: lwUser.role as 'admin' | 'instructor' | 'student',
    school_id: process.env.LEARNWORLDS_SCHOOL_ID || '',
    enrolled_courses: lwUser.enrolled_courses,
    tags: lwUser.tags
  };

  // Store response
  const result = await storeToolResponse(
    tool_slug,
    session_id,
    user,
    client_info || {},
    inputs || {},
    score || 0,
    {
      user_agent: req.headers['user-agent'],
      ip_address: req.ip || req.socket.remoteAddress,
      referrer: req.headers.referer,
      utm_source: context?.utm_source,
      utm_campaign: context?.utm_campaign,
      started_at: started_at ? new Date(started_at) : undefined
    }
  );

  if (!result.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to save response',
      message: result.error,
      code: 'STORAGE_ERROR'
    });
  }

  console.log(`[ToolResponse] Saved response ${result.response_id} for tool ${tool_slug}, user ${user.email}`);

  res.status(201).json({
    success: true,
    response_id: result.response_id,
    verdict: result.verdict,
    score: score,
    user: {
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      email: user.email
    }
  });
});

// ========== COMMITMENT UPDATE ==========

/**
 * PUT /api/tools/:tool_slug/responses/:response_id/commitment
 * Update or add commitment to a response
 */
router.put(
  '/:tool_slug/responses/:response_id/commitment',
  learnWorldsAuth({ required: true }),
  async (req: Request, res: Response) => {
    const { tool_slug, response_id } = req.params;
    const { text, deadline, accountability_partner, shared_with } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Commitment text is required'
      });
    }

    const result = await updateCommitment(tool_slug, response_id, {
      text,
      deadline: deadline ? new Date(deadline) : undefined,
      accountability_partner,
      shared_with
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      message: 'Commitment saved'
    });
  }
);

// ========== RESPONSE RETRIEVAL ==========

/**
 * GET /api/tools/:tool_slug/responses
 * Get responses for a tool (requires auth)
 *
 * Query params:
 * - user_id: Filter by user (admin only for other users)
 * - verdict: Filter by verdict (GO/NO_GO/MAYBE)
 * - from: Start date (ISO)
 * - to: End date (ISO)
 * - limit: Max results (default 100)
 * - skip: Offset for pagination
 */
router.get(
  '/:tool_slug/responses',
  learnWorldsAuth({ required: true }),
  async (req: Request, res: Response) => {
    const { tool_slug } = req.params;
    const { user_id, verdict, from, to, limit, skip } = req.query;

    const lwUser = req.lwUser!;

    // Non-admins can only see their own responses
    const filterUserId = lwUser.role === 'admin' && user_id
      ? user_id as string
      : lwUser.id;

    const responses = await getToolResponses(tool_slug, {
      user_id: filterUserId,
      verdict: verdict as 'GO' | 'NO_GO' | 'MAYBE' | undefined,
      from_date: from ? new Date(from as string) : undefined,
      to_date: to ? new Date(to as string) : undefined,
      limit: limit ? parseInt(limit as string) : 100,
      skip: skip ? parseInt(skip as string) : 0
    });

    res.json({
      success: true,
      tool_slug,
      count: responses.length,
      responses: responses.map(r => ({
        response_id: r.response_id,
        score: r.score,
        verdict: r.verdict,
        verdict_message: r.verdict_message,
        inputs: r.inputs,
        commitment: r.commitment,
        completed_at: r.completed_at,
        time_spent_seconds: r.time_spent_seconds
      }))
    });
  }
);

/**
 * GET /api/tools/:tool_slug/responses/:response_id
 * Get a specific response
 */
router.get(
  '/:tool_slug/responses/:response_id',
  learnWorldsAuth({ required: true }),
  async (req: Request, res: Response) => {
    const { tool_slug, response_id } = req.params;
    const lwUser = req.lwUser!;

    const responses = await getToolResponses(tool_slug, { limit: 1000 });
    const response = responses.find(r => r.response_id === response_id);

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'Response not found'
      });
    }

    // Non-admins can only see their own responses
    if (lwUser.role !== 'admin' && response.user.user_id !== lwUser.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      response
    });
  }
);

// ========== USER HISTORY ==========

/**
 * GET /api/tools/user/history
 * Get current user's response history across all tools
 */
router.get(
  '/user/history',
  learnWorldsAuth({ required: true }),
  async (req: Request, res: Response) => {
    const lwUser = req.lwUser!;

    const history = await getUserResponseHistory(lwUser.id);

    res.json({
      success: true,
      user_id: lwUser.id,
      tools_used: history.length,
      history: history.map(h => ({
        tool_slug: h.tool_slug,
        response_count: h.responses.length,
        latest_response: h.responses[0] ? {
          response_id: h.responses[0].response_id,
          score: h.responses[0].score,
          verdict: h.responses[0].verdict,
          completed_at: h.responses[0].completed_at
        } : null
      }))
    });
  }
);

// ========== TOOL METADATA ==========

/**
 * GET /api/tools/:tool_slug/metadata
 * Get tool metadata (questions, scoring config)
 */
router.get('/:tool_slug/metadata', async (req: Request, res: Response) => {
  const { tool_slug } = req.params;

  const metadata = await getToolMetadata(tool_slug);

  if (!metadata) {
    return res.status(404).json({
      success: false,
      error: 'Tool not found'
    });
  }

  res.json({
    success: true,
    tool: {
      tool_id: metadata.tool_id,
      tool_slug: metadata.tool_slug,
      tool_name: metadata.tool_name,
      category: metadata.category,
      decision: metadata.decision,
      tagline: metadata.tagline,
      estimated_time: metadata.estimated_time,
      questions: metadata.questions,
      scoring: {
        pass_threshold: metadata.scoring.pass_threshold,
        max_score: metadata.scoring.max_score
      },
      tool_url: metadata.tool_url,
      deployed_at: metadata.deployed_at
    }
  });
});

// ========== ANALYTICS ==========

/**
 * GET /api/tools/:tool_slug/analytics
 * Get tool analytics (admin only)
 */
router.get(
  '/:tool_slug/analytics',
  learnWorldsAuth({ required: true, roles: ['admin', 'instructor'] }),
  async (req: Request, res: Response) => {
    const { tool_slug } = req.params;

    const analytics = await getToolAnalytics(tool_slug);
    const metadata = await getToolMetadata(tool_slug);

    res.json({
      success: true,
      tool_slug,
      tool_name: metadata?.tool_name,
      analytics
    });
  }
);

// ========== ADMIN: LIST TOOLS ==========

/**
 * GET /api/tools
 * List all tools with collections (admin only)
 */
router.get(
  '/',
  learnWorldsAuth({ required: true, roles: ['admin'] }),
  async (req: Request, res: Response) => {
    const tools = await listToolCollections();

    const toolsWithMetadata = await Promise.all(
      tools.map(async (slug) => {
        const metadata = await getToolMetadata(slug);
        const analytics = await getToolAnalytics(slug);
        return {
          tool_slug: slug,
          tool_name: metadata?.tool_name,
          category: metadata?.category,
          deployed_at: metadata?.deployed_at,
          total_responses: analytics.total_responses,
          unique_users: analytics.unique_users
        };
      })
    );

    res.json({
      success: true,
      count: toolsWithMetadata.length,
      tools: toolsWithMetadata
    });
  }
);

// ========== CORS PREFLIGHT ==========

/**
 * OPTIONS /api/tools/*
 * Handle CORS preflight requests
 */
router.options('*', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

export default router;
