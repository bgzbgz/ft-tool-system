/**
 * LearnWorlds Integration Service
 * Handles SSO authentication and user validation via LearnWorlds LMS API
 *
 * API Docs: https://www.learnworlds.dev/docs/api/
 */

import { Request, Response, NextFunction } from 'express';

// ========== TYPES ==========

export interface LearnWorldsUser {
  id: string;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'instructor' | 'student';
  tags?: string[];
  enrolled_courses?: string[];
  created_at?: string;
  last_login?: string;
}

export interface LearnWorldsTokenPayload {
  user_id: string;
  email: string;
  role: string;
  school_id: string;
  exp: number;
  iat: number;
}

export interface LearnWorldsConfig {
  schoolId: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  ssoSecret: string;
  baseUrl: string;
}

export interface SSOValidationResult {
  valid: boolean;
  user?: LearnWorldsUser;
  error?: string;
}

// ========== CONFIGURATION ==========

function getLearnWorldsConfig(): LearnWorldsConfig {
  return {
    schoolId: process.env.LEARNWORLDS_SCHOOL_ID || '',
    apiKey: process.env.LEARNWORLDS_API_KEY || '',
    clientId: process.env.LEARNWORLDS_CLIENT_ID || '',
    clientSecret: process.env.LEARNWORLDS_CLIENT_SECRET || '',
    ssoSecret: process.env.LEARNWORLDS_SSO_SECRET || '',
    baseUrl: process.env.LEARNWORLDS_BASE_URL || 'https://api.learnworlds.com'
  };
}

export function isLearnWorldsConfigured(): boolean {
  const config = getLearnWorldsConfig();
  return !!(config.schoolId && config.apiKey);
}

// ========== JWT VALIDATION ==========

/**
 * Decode and validate LearnWorlds SSO token
 * LearnWorlds uses HS256 JWT tokens signed with SSO secret
 */
export function decodeLearnWorldsToken(token: string): LearnWorldsTokenPayload | null {
  try {
    const config = getLearnWorldsConfig();

    // Split JWT parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[LearnWorlds] Invalid token format');
      return null;
    }

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );

    // Verify expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.log('[LearnWorlds] Token expired');
      return null;
    }

    // In production, verify signature with HMAC-SHA256
    // For now, we trust the payload structure
    // TODO: Add proper HMAC verification with config.ssoSecret

    return payload as LearnWorldsTokenPayload;
  } catch (error) {
    console.error('[LearnWorlds] Token decode error:', error);
    return null;
  }
}

// ========== API CALLS ==========

/**
 * Fetch user details from LearnWorlds API
 */
export async function getLearnWorldsUser(userId: string): Promise<LearnWorldsUser | null> {
  const config = getLearnWorldsConfig();

  if (!config.apiKey || !config.schoolId) {
    console.log('[LearnWorlds] API not configured');
    return null;
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/v2/users/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Lw-Client': config.schoolId,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.log(`[LearnWorlds] User fetch failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role || 'student',
      tags: data.tags || [],
      enrolled_courses: data.enrolled_products?.map((p: any) => p.id) || [],
      created_at: data.created,
      last_login: data.last_login
    };
  } catch (error) {
    console.error('[LearnWorlds] API error:', error);
    return null;
  }
}

/**
 * Validate user is enrolled in required course (optional gating)
 */
export async function validateCourseEnrollment(
  userId: string,
  courseId: string
): Promise<boolean> {
  const config = getLearnWorldsConfig();

  try {
    const response = await fetch(
      `${config.baseUrl}/v2/users/${userId}/courses/${courseId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Lw-Client': config.schoolId
        }
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[LearnWorlds] Enrollment check error:', error);
    return false;
  }
}

// ========== SSO VALIDATION ==========

/**
 * Validate SSO token and return user
 */
export async function validateSSOToken(token: string): Promise<SSOValidationResult> {
  // Decode token
  const payload = decodeLearnWorldsToken(token);

  if (!payload) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  // Fetch full user details from API
  const user = await getLearnWorldsUser(payload.user_id);

  if (!user) {
    return { valid: false, error: 'User not found' };
  }

  return { valid: true, user };
}

// ========== WEBHOOK HANDLERS ==========

/**
 * Handle LearnWorlds webhook events
 * Supported events: user.created, user.enrolled, course.completed
 */
export interface LearnWorldsWebhookPayload {
  event: string;
  school_id: string;
  data: {
    user_id?: string;
    email?: string;
    course_id?: string;
    [key: string]: any;
  };
  timestamp: string;
}

export function parseWebhookPayload(body: any): LearnWorldsWebhookPayload | null {
  try {
    if (!body.event || !body.school_id || !body.data) {
      return null;
    }
    return body as LearnWorldsWebhookPayload;
  } catch {
    return null;
  }
}

/**
 * Verify webhook signature (X-Lw-Signature header)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const config = getLearnWorldsConfig();

  if (!config.ssoSecret) {
    console.warn('[LearnWorlds] SSO secret not configured, skipping signature check');
    return true; // Allow in development
  }

  // LearnWorlds uses HMAC-SHA256 for webhook signatures
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', config.ssoSecret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}

// ========== EXPRESS MIDDLEWARE ==========

/**
 * Extend Express Request with LearnWorlds user
 */
declare global {
  namespace Express {
    interface Request {
      lwUser?: LearnWorldsUser;
    }
  }
}

/**
 * Authentication middleware - validates LearnWorlds SSO token
 * Token can be in:
 * - Authorization header: Bearer <token>
 * - Query param: ?lw_token=<token>
 * - Cookie: lw_sso_token
 */
export function learnWorldsAuth(
  options: { required?: boolean; allowedRoles?: string[] } = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const { required = true, allowedRoles } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if LearnWorlds not configured
    if (!isLearnWorldsConfigured()) {
      if (required) {
        console.warn('[LearnWorlds] Auth required but not configured');
      }
      return next();
    }

    // Extract token from various sources
    let token: string | undefined;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check query param
    if (!token && req.query.lw_token) {
      token = req.query.lw_token as string;
    }

    // Check cookie
    if (!token && req.cookies?.lw_sso_token) {
      token = req.cookies.lw_sso_token;
    }

    // No token found
    if (!token) {
      if (required) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      return next();
    }

    // Validate token
    const result = await validateSSOToken(token);

    if (!result.valid || !result.user) {
      if (required) {
        return res.status(401).json({
          error: result.error || 'Invalid authentication',
          code: 'AUTH_INVALID'
        });
      }
      return next();
    }

    // Check role if specified
    if (allowedRoles && !allowedRoles.includes(result.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }

    // Attach user to request
    req.lwUser = result.user;
    next();
  };
}

/**
 * Admin-only middleware
 */
export const requireAdmin = learnWorldsAuth({
  required: true,
  allowedRoles: ['admin']
});

/**
 * Instructor or admin middleware
 */
export const requireInstructor = learnWorldsAuth({
  required: true,
  allowedRoles: ['admin', 'instructor']
});

/**
 * Optional auth - attaches user if token present
 */
export const optionalAuth = learnWorldsAuth({ required: false });
