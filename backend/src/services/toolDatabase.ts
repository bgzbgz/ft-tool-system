/**
 * Tool Database Service
 * Manages MongoDB collections for generated tools
 *
 * Each tool gets its own collection containing:
 * - Metadata document (tool content, questions)
 * - Response documents (client submissions with LearnWorlds auth)
 * - Analytics documents (aggregated stats)
 */

import { MongoClient, Db, Collection, CreateIndexesOptions } from 'mongodb';
import * as cheerio from 'cheerio';
import {
  ToolMetadataDocument,
  ToolResponseDocument,
  ToolQuestion,
  ScoringCriteria,
  LearnWorldsUserInfo,
  ToolCollectionIndexes,
  getToolCollectionName,
  generateResponseId,
  validateLearnWorldsUser,
  calculateVerdict
} from '../models/toolCollection';

// ========== CONFIGURATION ==========

interface ToolDatabaseConfig {
  uri: string;
  dbName: string;
}

let mongoClient: MongoClient | null = null;
let database: Db | null = null;

function getConfig(): ToolDatabaseConfig {
  return {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_TOOL_DB || 'fast_track_tools'
  };
}

// ========== CONNECTION MANAGEMENT ==========

/**
 * Connect to MongoDB
 */
export async function connectToMongo(): Promise<Db> {
  if (database) return database;

  const config = getConfig();
  console.log('[ToolDB] Connecting to MongoDB...');

  mongoClient = new MongoClient(config.uri, {
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    w: 'majority'
  });

  await mongoClient.connect();
  database = mongoClient.db(config.dbName);

  console.log(`[ToolDB] Connected to database: ${config.dbName}`);
  return database;
}

/**
 * Close MongoDB connection
 */
export async function closeMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    database = null;
    console.log('[ToolDB] MongoDB connection closed');
  }
}

/**
 * Get database instance
 */
export async function getDatabase(): Promise<Db> {
  if (!database) {
    return await connectToMongo();
  }
  return database;
}

// ========== COLLECTION PROVISIONING ==========

/**
 * Provision a new collection for a deployed tool
 * Called when a tool is deployed via GitHub Actions or n8n
 */
export async function provisionToolCollection(
  toolSlug: string,
  toolId: string,
  toolHtml: string,
  metadata: {
    tool_name: string;
    category: 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';
    decision: string;
    tagline?: string;
    estimated_time?: string;
    tool_url: string;
    deployed_by?: string;
    qa_score?: number;
    revision_count?: number;
  }
): Promise<{ success: boolean; collection_name: string; questions_found: number; error?: string }> {
  try {
    const db = await getDatabase();
    const collectionName = getToolCollectionName(toolSlug);

    console.log(`[ToolDB] Provisioning collection: ${collectionName}`);

    // Create collection if it doesn't exist
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      await db.createCollection(collectionName);
      console.log(`[ToolDB] Created collection: ${collectionName}`);
    }

    const collection = db.collection(collectionName);

    // Create indexes
    await createToolIndexes(collection);

    // Parse questions from HTML
    const questions = parseQuestionsFromHtml(toolHtml);
    const scoring = parseScoringFromHtml(toolHtml);

    // Create or update metadata document
    const metadataDoc: ToolMetadataDocument = {
      _type: 'metadata',
      tool_id: toolId,
      tool_slug: toolSlug,
      tool_name: metadata.tool_name,
      category: metadata.category,
      decision: metadata.decision,
      tagline: metadata.tagline || '',
      estimated_time: metadata.estimated_time || '5 minutes',
      questions: questions,
      scoring: scoring,
      tool_html: toolHtml,
      deployed_at: new Date(),
      deployed_by: metadata.deployed_by,
      qa_score: metadata.qa_score,
      revision_count: metadata.revision_count,
      tool_url: metadata.tool_url
    };

    await collection.updateOne(
      { _type: 'metadata', tool_id: toolId },
      { $set: metadataDoc },
      { upsert: true }
    );

    console.log(`[ToolDB] Metadata stored with ${questions.length} questions`);

    return {
      success: true,
      collection_name: collectionName,
      questions_found: questions.length
    };

  } catch (error) {
    console.error('[ToolDB] Provisioning error:', error);
    return {
      success: false,
      collection_name: getToolCollectionName(toolSlug),
      questions_found: 0,
      error: (error as Error).message
    };
  }
}

/**
 * Create indexes for a tool collection
 */
async function createToolIndexes(collection: Collection): Promise<void> {
  console.log(`[ToolDB] Creating indexes for: ${collection.collectionName}`);

  for (const indexDef of ToolCollectionIndexes) {
    try {
      await collection.createIndex(indexDef.key);
    } catch (error) {
      // Index might already exist, which is fine
      console.log(`[ToolDB] Index exists or created: ${JSON.stringify(indexDef.key)}`);
    }
  }
}

// ========== HTML PARSING ==========

/**
 * Parse questions/inputs from tool HTML
 */
export function parseQuestionsFromHtml(html: string): ToolQuestion[] {
  const $ = cheerio.load(html);
  const questions: ToolQuestion[] = [];

  // Find all form inputs with labels
  $('label').each((i, labelEl) => {
    const $label = $(labelEl);
    const labelText = $label.text().trim();
    const forAttr = $label.attr('for');

    // Find associated input
    let $input = forAttr ? $(`#${forAttr}`) : $label.find('input, select, textarea').first();

    if ($input.length === 0) {
      $input = $label.next('input, select, textarea');
    }

    if ($input.length > 0 && labelText) {
      const fieldName = $input.attr('name') || $input.attr('id') || `field_${i}`;
      const tagName = $input.prop('tagName')?.toLowerCase();
      const inputType = $input.attr('type') || 'text';

      const question: ToolQuestion = {
        field_name: fieldName,
        label: labelText.replace(/[*:]/g, '').trim(),
        field_type: mapInputType(tagName, inputType),
        required: $input.attr('required') !== undefined
      };

      // Handle select options
      if (tagName === 'select') {
        question.options = $input.find('option').map((_, opt) => $(opt).text().trim()).get();
      }

      // Handle radio/checkbox groups
      if (inputType === 'radio' || inputType === 'checkbox') {
        const groupName = $input.attr('name');
        if (groupName) {
          question.options = $(`input[name="${groupName}"]`).map((_, inp) => {
            const $inp = $(inp);
            return $inp.attr('value') || $inp.next('span, label').text().trim();
          }).get();
        }
      }

      // Handle range inputs
      if (inputType === 'range' || inputType === 'number') {
        question.min = parseInt($input.attr('min') || '0');
        question.max = parseInt($input.attr('max') || '100');
      }

      questions.push(question);
    }
  });

  // Also look for standalone inputs with data attributes
  $('input[data-question], select[data-question], textarea[data-question]').each((i, el) => {
    const $el = $(el);
    const questionText = $el.attr('data-question');

    if (questionText && !questions.find(q => q.field_name === $el.attr('name'))) {
      questions.push({
        field_name: $el.attr('name') || `data_field_${i}`,
        label: questionText,
        field_type: mapInputType($el.prop('tagName').toLowerCase(), $el.attr('type')),
        required: $el.attr('required') !== undefined
      });
    }
  });

  console.log(`[ToolDB] Parsed ${questions.length} questions from HTML`);
  return questions;
}

/**
 * Map HTML input types to our field types
 */
function mapInputType(tagName: string | undefined, inputType: string | undefined): ToolQuestion['field_type'] {
  if (tagName === 'select') return 'select';
  if (tagName === 'textarea') return 'textarea';

  switch (inputType) {
    case 'number':
      return 'number';
    case 'range':
      return 'range';
    case 'radio':
      return 'radio';
    case 'checkbox':
      return 'checkbox';
    default:
      return 'text';
  }
}

/**
 * Parse scoring configuration from HTML
 */
function parseScoringFromHtml(html: string): ToolMetadataDocument['scoring'] {
  const $ = cheerio.load(html);
  const criteria: ScoringCriteria[] = [];

  // Look for scoring configuration in script tags
  $('script').each((i, el) => {
    const scriptContent = $(el).html() || '';

    // Look for scoring config object
    const scoringMatch = scriptContent.match(/scoringConfig\s*=\s*({[\s\S]*?});/);
    if (scoringMatch) {
      try {
        const config = JSON.parse(scoringMatch[1].replace(/'/g, '"'));
        if (config.criteria) {
          criteria.push(...config.criteria);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Look for weight assignments
    const weightMatches = scriptContent.matchAll(/['"]?(\w+)['"]?\s*:\s*{\s*weight\s*:\s*(\d+)/g);
    for (const match of weightMatches) {
      criteria.push({
        field_name: match[1],
        weight: parseInt(match[2]),
        scoring_logic: 'Extracted from HTML'
      });
    }
  });

  // Look for data attributes with scoring info
  $('[data-weight]').each((i, el) => {
    const $el = $(el);
    criteria.push({
      field_name: $el.attr('name') || $el.attr('id') || `scored_field_${i}`,
      weight: parseInt($el.attr('data-weight') || '1'),
      scoring_logic: $el.attr('data-scoring') || 'Default scoring'
    });
  });

  return {
    criteria: criteria,
    pass_threshold: 70,  // Default Fast Track threshold
    max_score: 100
  };
}

// ========== RESPONSE MANAGEMENT ==========

/**
 * Store a client response
 * Called from n8n webhook after LearnWorlds auth validation
 */
export async function storeToolResponse(
  toolSlug: string,
  sessionId: string,
  user: LearnWorldsUserInfo,
  clientInfo: Record<string, any>,
  inputs: Record<string, any>,
  score: number,
  context?: {
    user_agent?: string;
    ip_address?: string;
    referrer?: string;
    utm_source?: string;
    utm_campaign?: string;
    started_at?: Date;
  }
): Promise<{ success: boolean; response_id: string; verdict: string; error?: string }> {
  try {
    if (!validateLearnWorldsUser(user)) {
      return {
        success: false,
        response_id: '',
        verdict: '',
        error: 'Invalid LearnWorlds user data'
      };
    }

    const db = await getDatabase();
    const collectionName = getToolCollectionName(toolSlug);
    const collection = db.collection(collectionName);

    // Get metadata to calculate verdict
    const metadata = await collection.findOne({ _type: 'metadata' }) as ToolMetadataDocument | null;
    const maxScore = metadata?.scoring?.max_score || 100;
    const passThreshold = metadata?.scoring?.pass_threshold || 70;

    const { verdict, message } = calculateVerdict(score, passThreshold, maxScore);

    const responseId = generateResponseId();
    const completedAt = new Date();
    const startedAt = context?.started_at || new Date(completedAt.getTime() - 300000); // Default 5 min ago

    const responseDoc: ToolResponseDocument = {
      _type: 'response',
      response_id: responseId,
      session_id: sessionId,
      user: user,
      client_info: clientInfo,
      inputs: inputs,
      score: score,
      verdict: verdict,
      verdict_message: message,
      started_at: startedAt,
      completed_at: completedAt,
      time_spent_seconds: Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
      context: {
        user_agent: context?.user_agent,
        ip_address: context?.ip_address,
        referrer: context?.referrer,
        utm_source: context?.utm_source,
        utm_campaign: context?.utm_campaign
      }
    };

    await collection.insertOne(responseDoc);

    console.log(`[ToolDB] Response stored: ${responseId} for user ${user.user_id}`);

    return {
      success: true,
      response_id: responseId,
      verdict: verdict
    };

  } catch (error) {
    console.error('[ToolDB] Response storage error:', error);
    return {
      success: false,
      response_id: '',
      verdict: '',
      error: (error as Error).message
    };
  }
}

/**
 * Update commitment for a response
 */
export async function updateCommitment(
  toolSlug: string,
  responseId: string,
  commitment: {
    text: string;
    deadline?: Date;
    accountability_partner?: string;
    shared_with?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();
    const collectionName = getToolCollectionName(toolSlug);
    const collection = db.collection(collectionName);

    await collection.updateOne(
      { _type: 'response', response_id: responseId },
      {
        $set: {
          commitment: {
            ...commitment,
            status: 'active'
          }
        }
      }
    );

    console.log(`[ToolDB] Commitment updated for response: ${responseId}`);
    return { success: true };

  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ========== QUERY FUNCTIONS ==========

/**
 * Get tool metadata
 */
export async function getToolMetadata(toolSlug: string): Promise<ToolMetadataDocument | null> {
  const db = await getDatabase();
  const collectionName = getToolCollectionName(toolSlug);
  const collection = db.collection(collectionName);

  return await collection.findOne({ _type: 'metadata' }) as ToolMetadataDocument | null;
}

/**
 * Get responses for a tool
 */
export async function getToolResponses(
  toolSlug: string,
  options?: {
    user_id?: string;
    verdict?: 'GO' | 'NO_GO' | 'MAYBE';
    from_date?: Date;
    to_date?: Date;
    limit?: number;
    skip?: number;
  }
): Promise<ToolResponseDocument[]> {
  const db = await getDatabase();
  const collectionName = getToolCollectionName(toolSlug);
  const collection = db.collection(collectionName);

  const query: any = { _type: 'response' };

  if (options?.user_id) {
    query['user.user_id'] = options.user_id;
  }
  if (options?.verdict) {
    query.verdict = options.verdict;
  }
  if (options?.from_date || options?.to_date) {
    query.completed_at = {};
    if (options.from_date) query.completed_at.$gte = options.from_date;
    if (options.to_date) query.completed_at.$lte = options.to_date;
  }

  return await collection
    .find(query)
    .sort({ completed_at: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 100)
    .toArray() as ToolResponseDocument[];
}

/**
 * Get user's response history across all tools
 */
export async function getUserResponseHistory(userId: string): Promise<{
  tool_slug: string;
  responses: ToolResponseDocument[];
}[]> {
  const db = await getDatabase();
  const collections = await db.listCollections().toArray();

  const history: { tool_slug: string; responses: ToolResponseDocument[] }[] = [];

  for (const col of collections) {
    if (col.name.startsWith('tool_')) {
      const collection = db.collection(col.name);
      const responses = await collection
        .find({ _type: 'response', 'user.user_id': userId })
        .sort({ completed_at: -1 })
        .toArray() as ToolResponseDocument[];

      if (responses.length > 0) {
        history.push({
          tool_slug: col.name.replace('tool_', ''),
          responses: responses
        });
      }
    }
  }

  return history;
}

/**
 * Get analytics for a tool
 */
export async function getToolAnalytics(toolSlug: string): Promise<{
  total_responses: number;
  unique_users: number;
  avg_score: number;
  verdict_distribution: { GO: number; NO_GO: number; MAYBE: number };
  avg_time_spent: number;
}> {
  const db = await getDatabase();
  const collectionName = getToolCollectionName(toolSlug);
  const collection = db.collection(collectionName);

  const pipeline = [
    { $match: { _type: 'response' } },
    {
      $group: {
        _id: null,
        total_responses: { $sum: 1 },
        unique_users: { $addToSet: '$user.user_id' },
        avg_score: { $avg: '$score' },
        avg_time: { $avg: '$time_spent_seconds' },
        go_count: { $sum: { $cond: [{ $eq: ['$verdict', 'GO'] }, 1, 0] } },
        no_go_count: { $sum: { $cond: [{ $eq: ['$verdict', 'NO_GO'] }, 1, 0] } },
        maybe_count: { $sum: { $cond: [{ $eq: ['$verdict', 'MAYBE'] }, 1, 0] } }
      }
    }
  ];

  const results = await collection.aggregate(pipeline).toArray();

  if (results.length === 0) {
    return {
      total_responses: 0,
      unique_users: 0,
      avg_score: 0,
      verdict_distribution: { GO: 0, NO_GO: 0, MAYBE: 0 },
      avg_time_spent: 0
    };
  }

  const r = results[0];
  return {
    total_responses: r.total_responses,
    unique_users: r.unique_users.length,
    avg_score: Math.round(r.avg_score * 10) / 10,
    verdict_distribution: {
      GO: r.go_count,
      NO_GO: r.no_go_count,
      MAYBE: r.maybe_count
    },
    avg_time_spent: Math.round(r.avg_time)
  };
}

// ========== ADMIN FUNCTIONS ==========

/**
 * List all tool collections
 */
export async function listToolCollections(): Promise<string[]> {
  const db = await getDatabase();
  const collections = await db.listCollections().toArray();

  return collections
    .filter(c => c.name.startsWith('tool_'))
    .map(c => c.name.replace('tool_', ''));
}

/**
 * Delete a tool collection
 */
export async function deleteToolCollection(toolSlug: string): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();
    const collectionName = getToolCollectionName(toolSlug);

    await db.dropCollection(collectionName);
    console.log(`[ToolDB] Deleted collection: ${collectionName}`);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Export tool data (for backup/migration)
 */
export async function exportToolData(toolSlug: string): Promise<{
  metadata: ToolMetadataDocument | null;
  responses: ToolResponseDocument[];
}> {
  const db = await getDatabase();
  const collectionName = getToolCollectionName(toolSlug);
  const collection = db.collection(collectionName);

  const metadata = await collection.findOne({ _type: 'metadata' }) as ToolMetadataDocument | null;
  const responses = await collection.find({ _type: 'response' }).toArray() as ToolResponseDocument[];

  return { metadata, responses };
}
