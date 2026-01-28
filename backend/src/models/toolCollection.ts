/**
 * Tool Collection Model
 * Each generated tool gets its own MongoDB collection with this schema
 *
 * Structure:
 * - Default Data: Tool content, questions, metadata (created at deployment)
 * - Client Data: User responses with LearnWorlds auth info
 */

// ========== TYPES ==========

/**
 * Question/Input field extracted from the tool HTML
 */
export interface ToolQuestion {
  field_name: string;           // Input name/id from HTML
  label: string;                // Question text shown to user
  field_type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'range';
  required: boolean;
  options?: string[];           // For select/radio/checkbox
  min?: number;                 // For range/number
  max?: number;
  validation?: string;          // Validation pattern
}

/**
 * Scoring criteria extracted from tool
 */
export interface ScoringCriteria {
  field_name: string;
  weight: number;
  scoring_logic: string;        // Description of how this affects score
}

/**
 * Tool metadata document - stored once per collection
 * This is the "default data" - content of the tool
 */
export interface ToolMetadataDocument {
  _type: 'metadata';            // Discriminator for document type
  tool_id: string;
  tool_slug: string;
  tool_name: string;
  category: 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';
  decision: string;
  tagline: string;
  estimated_time: string;

  // Questions/inputs extracted from the tool HTML
  questions: ToolQuestion[];

  // Scoring configuration
  scoring: {
    criteria: ScoringCriteria[];
    pass_threshold: number;
    max_score: number;
  };

  // Full HTML stored for reference
  tool_html: string;

  // Deployment info
  deployed_at: Date;
  deployed_by?: string;
  qa_score?: number;
  revision_count?: number;

  // Tool URL
  tool_url: string;
}

/**
 * LearnWorlds user info from SSO
 * This comes from the HTTP node in n8n
 */
export interface LearnWorldsUserInfo {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: 'admin' | 'instructor' | 'student';
  school_id: string;
  enrolled_courses?: string[];
  tags?: string[];
}

/**
 * Client response document - one per submission
 * This is the "additional data" - what clients fill in
 */
export interface ToolResponseDocument {
  _type: 'response';            // Discriminator for document type
  response_id: string;          // Unique response ID
  session_id: string;           // Browser session ID

  // User authentication (from LearnWorlds via n8n HTTP node)
  user: LearnWorldsUserInfo;

  // Additional client info (filled in the tool)
  client_info: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    job_title?: string;
    industry?: string;
    company_size?: string;
    [key: string]: any;         // Additional custom fields
  };

  // Tool inputs - answers to questions
  inputs: Record<string, any>;

  // Results
  score: number;
  verdict: 'GO' | 'NO_GO' | 'MAYBE';
  verdict_message: string;

  // Commitment mechanism (Fast Track DNA)
  commitment?: {
    text: string;
    deadline?: Date;
    accountability_partner?: string;
    shared_with?: string[];
    status: 'active' | 'completed' | 'abandoned';
  };

  // Timestamps
  started_at: Date;
  completed_at: Date;
  time_spent_seconds: number;

  // Device/context info
  context: {
    user_agent?: string;
    ip_address?: string;
    referrer?: string;
    utm_source?: string;
    utm_campaign?: string;
  };
}

/**
 * Analytics aggregation document
 */
export interface ToolAnalyticsDocument {
  _type: 'analytics';
  period: 'daily' | 'weekly' | 'monthly';
  date: Date;

  stats: {
    total_responses: number;
    unique_users: number;
    avg_score: number;
    avg_time_spent: number;
    verdict_distribution: {
      GO: number;
      NO_GO: number;
      MAYBE: number;
    };
    completion_rate: number;
    commitment_rate: number;
  };
}

// ========== SCHEMA DEFINITIONS ==========

/**
 * MongoDB schema for tool collections
 * Collection naming: tool_{tool_slug}
 */
export const ToolCollectionSchemas = {
  metadata: {
    _type: { type: String, default: 'metadata', index: true },
    tool_id: { type: String, required: true, unique: true },
    tool_slug: { type: String, required: true, unique: true },
    tool_name: { type: String, required: true },
    category: { type: String, required: true, enum: ['b2b_product', 'b2b_service', 'b2c_product', 'b2c_service'] },
    decision: { type: String, required: true },
    tagline: { type: String },
    estimated_time: { type: String },
    questions: [{
      field_name: String,
      label: String,
      field_type: { type: String, enum: ['text', 'number', 'select', 'radio', 'checkbox', 'textarea', 'range'] },
      required: Boolean,
      options: [String],
      min: Number,
      max: Number,
      validation: String
    }],
    scoring: {
      criteria: [{
        field_name: String,
        weight: Number,
        scoring_logic: String
      }],
      pass_threshold: Number,
      max_score: Number
    },
    tool_html: { type: String, maxlength: 10 * 1024 * 1024 },
    deployed_at: { type: Date, default: Date.now },
    deployed_by: String,
    qa_score: Number,
    revision_count: Number,
    tool_url: String
  },

  response: {
    _type: { type: String, default: 'response', index: true },
    response_id: { type: String, required: true, unique: true, index: true },
    session_id: { type: String, required: true, index: true },
    user: {
      user_id: { type: String, required: true, index: true },
      email: { type: String, required: true },
      first_name: String,
      last_name: String,
      role: { type: String, enum: ['admin', 'instructor', 'student'] },
      school_id: String,
      enrolled_courses: [String],
      tags: [String]
    },
    client_info: {
      type: Object,
      default: {}
    },
    inputs: {
      type: Object,
      required: true
    },
    score: { type: Number, required: true },
    verdict: { type: String, required: true, enum: ['GO', 'NO_GO', 'MAYBE'] },
    verdict_message: String,
    commitment: {
      text: String,
      deadline: Date,
      accountability_partner: String,
      shared_with: [String],
      status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' }
    },
    started_at: { type: Date, required: true },
    completed_at: { type: Date, required: true, default: Date.now },
    time_spent_seconds: Number,
    context: {
      user_agent: String,
      ip_address: String,
      referrer: String,
      utm_source: String,
      utm_campaign: String
    }
  },

  analytics: {
    _type: { type: String, default: 'analytics', index: true },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], index: true },
    date: { type: Date, required: true, index: true },
    stats: {
      total_responses: Number,
      unique_users: Number,
      avg_score: Number,
      avg_time_spent: Number,
      verdict_distribution: {
        GO: Number,
        NO_GO: Number,
        MAYBE: Number
      },
      completion_rate: Number,
      commitment_rate: Number
    }
  }
};

// ========== INDEX DEFINITIONS ==========

/**
 * Indexes to create for each tool collection
 */
export const ToolCollectionIndexes = [
  // Type discriminator for querying
  { key: { _type: 1 } },

  // Response queries
  { key: { 'user.user_id': 1, completed_at: -1 } },
  { key: { session_id: 1 } },
  { key: { completed_at: -1 } },
  { key: { verdict: 1, completed_at: -1 } },
  { key: { score: 1 } },

  // Analytics queries
  { key: { _type: 1, period: 1, date: -1 } },

  // Client info searches
  { key: { 'client_info.company': 1 } },
  { key: { 'client_info.email': 1 } },

  // Compound index for user response history
  { key: { 'user.user_id': 1, _type: 1, completed_at: -1 } }
];

// ========== HELPER FUNCTIONS ==========

/**
 * Generate collection name from tool slug
 */
export function getToolCollectionName(toolSlug: string): string {
  // Sanitize slug for MongoDB collection naming
  const sanitized = toolSlug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60);  // MongoDB collection name limit considerations

  return `tool_${sanitized}`;
}

/**
 * Generate unique response ID
 */
export function generateResponseId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `resp_${timestamp}_${random}`;
}

/**
 * Validate LearnWorlds user info
 */
export function validateLearnWorldsUser(user: any): user is LearnWorldsUserInfo {
  return (
    typeof user === 'object' &&
    typeof user.user_id === 'string' &&
    typeof user.email === 'string' &&
    ['admin', 'instructor', 'student'].includes(user.role)
  );
}

/**
 * Calculate verdict from score and threshold
 */
export function calculateVerdict(
  score: number,
  passThreshold: number,
  maxScore: number
): { verdict: 'GO' | 'NO_GO' | 'MAYBE'; message: string } {
  const percentage = (score / maxScore) * 100;

  if (percentage >= passThreshold) {
    return {
      verdict: 'GO',
      message: `Score ${score}/${maxScore} (${percentage.toFixed(0)}%) meets the threshold. Proceed with confidence.`
    };
  }

  if (percentage >= passThreshold - 15) {
    return {
      verdict: 'MAYBE',
      message: `Score ${score}/${maxScore} (${percentage.toFixed(0)}%) is close. Review the gaps before deciding.`
    };
  }

  return {
    verdict: 'NO_GO',
    message: `Score ${score}/${maxScore} (${percentage.toFixed(0)}%) indicates significant gaps. Reconsider this decision.`
  };
}
