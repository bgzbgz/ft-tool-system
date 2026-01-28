/**
 * Fast Track Secretary Agent
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Parses and normalizes boss tool requests
 */

import { callAI, getProviderForRole } from '../provider';

// ========== SYSTEM PROMPT ==========

const SECRETARY_SYSTEM_PROMPT = `You are the Fast Track Secretary. Your job is to parse and understand the boss's tool request.

## YOUR RESPONSIBILITIES
1. Extract the core tool request from potentially messy input
2. Identify the tool category (B2B/B2C, Product/Service)
3. Determine the appropriate decision type
4. Normalize requirements into structured format

## CATEGORY DEFINITIONS

### B2B Product (b2b_product)
User evaluating a PRODUCT purchase for their business.
- Key factors: TCO, integration, vendor stability, implementation timeline, scalability
- Decision: GO / NO-GO
- Example: CRM software, manufacturing equipment, cloud platform

### B2B Service (b2b_service)
User evaluating a SERVICE provider (agency, consultant, partner).
- Key factors: Expertise, cultural fit, pricing model, knowledge transfer, exit strategy
- Decision: HIRE / DON'T HIRE
- Example: Marketing agency, IT consultant, legal firm

### B2C Product (b2c_product)
User making a PERSONAL product purchase.
- Key factors: Budget reality, needs vs wants, timing, lifestyle fit
- Decision: BUY NOW / WAIT / SKIP
- Example: Car, appliance, electronics, furniture

### B2C Service (b2c_service)
User evaluating a PERSONAL service (coaching, fitness, education).
- Key factors: Personal readiness, provider chemistry, commitment level, realistic expectations
- Decision: COMMIT / NOT READY / WRONG FIT
- Example: Personal trainer, therapist, online course, coaching program

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no explanation):
{
  "tool_name": "Clear, action-oriented name",
  "slug": "tool-name-lowercase-hyphenated",
  "category": "b2b_product | b2b_service | b2c_product | b2c_service",
  "decision_type": "The appropriate decision format for this category",
  "target_audience": "Who will use this tool",
  "tagline": "One punchy sentence describing what the tool does",
  "key_requirements": ["requirement1", "requirement2", "requirement3"],
  "context_summary": "2-3 sentence summary of what the boss wants",
  "estimated_questions": 5-10
}`;

// ========== INTERFACES ==========

export type ToolCategory = 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';

export interface SecretaryOutput {
  tool_name: string;
  slug: string;
  category: ToolCategory;
  decision_type: string;
  target_audience: string;
  tagline: string;
  key_requirements: string[];
  context_summary: string;
  estimated_questions: number;
}

// ========== AGENT FUNCTION ==========

/**
 * Run the Secretary agent to parse boss input
 */
export async function runSecretary(bossInput: string): Promise<SecretaryOutput> {
  console.log('[Secretary] Parsing boss request...');

  const response = await callAI(
    SECRETARY_SYSTEM_PROMPT,
    bossInput,
    { provider: getProviderForRole('primary') }
  );

  // Parse JSON response
  try {
    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const output = JSON.parse(jsonStr) as SecretaryOutput;

    // Validate required fields
    if (!output.tool_name || !output.category || !output.decision_type) {
      throw new Error('Missing required fields in Secretary output');
    }

    // Validate category
    const validCategories: ToolCategory[] = ['b2b_product', 'b2b_service', 'b2c_product', 'b2c_service'];
    if (!validCategories.includes(output.category)) {
      throw new Error(`Invalid category: ${output.category}`);
    }

    console.log(`[Secretary] Parsed: "${output.tool_name}" (${output.category})`);
    return output;

  } catch (error) {
    console.error('[Secretary] Failed to parse response:', error);
    console.error('[Secretary] Raw response:', response.content);
    throw new Error(`Secretary failed to parse boss input: ${error}`);
  }
}

/**
 * Get the decision type for a category
 */
export function getDecisionTypeForCategory(category: ToolCategory): string {
  const decisionTypes: Record<ToolCategory, string> = {
    b2b_product: 'GO / NO-GO',
    b2b_service: 'HIRE / DON\'T HIRE',
    b2c_product: 'BUY NOW / WAIT / SKIP',
    b2c_service: 'COMMIT / NOT READY / WRONG FIT'
  };
  return decisionTypes[category];
}
