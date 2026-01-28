/**
 * Fast Track QA Department Agent
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Validates tools against 8-point criteria
 * IMPORTANT: Uses DIFFERENT AI provider (Gemini) to avoid bias
 */

import { callAI, getProviderForRole } from '../provider';
import { ToolSpec } from './builder';

// ========== SYSTEM PROMPT ==========

const QA_SYSTEM_PROMPT = `You are the Fast Track QA Department. You validate tools against strict criteria.

YOU USE A DIFFERENT AI MODEL TO ENSURE NO BIAS. Your job is to be ruthlessly critical.

## VALIDATION CHECKLIST

### 8-Point Criteria (Each scored 0-100)

1. FORCES DECISION (0-100)
   - Does tool end with concrete verdict? Not "consider" but "DO THIS"
   - Is there a clear GO/NO-GO or equivalent decision?
   - FAIL if: Ends with "things to think about" or multiple options without recommendation

2. ZERO INSTRUCTIONS (0-100)
   - Is it self-evident? Would a CEO understand without reading docs?
   - Are all labels clear without jargon?
   - FAIL if: Any "how to use" text, instructions, or confusing terms

3. EASY FIRST STEPS (0-100)
   - Does first input feel achievable in <10 seconds?
   - Is there ghost text showing what to write?
   - FAIL if: First question is complex, intimidating, or requires research

4. INSTANT FEEDBACK (0-100)
   - Does every input show immediate response?
   - Are there validation states (red/green)?
   - FAIL if: No visual feedback on inputs, no validation

5. GAMIFICATION (0-100)
   - Are there progress bars, scores, celebrations?
   - Does it feel engaging, not like a boring form?
   - FAIL if: No progress indicator, no reward moments

6. VISIBLE RESULTS (0-100)
   - Is output crystal clear and exportable?
   - Can user see exactly what they achieved?
   - FAIL if: Results are vague, can't be shared

7. COMMITMENT CAPTURE (0-100)
   - Is there a specific "I will do X by Y" mechanism?
   - Does it create accountability?
   - FAIL if: No commitment section, or commitment is optional/weak

8. FAST TRACK DNA (0-100)
   - Does it feel €20K premium? Bold? Direct? Gritty?
   - Black/white design with yellow accent?
   - FAIL if: Generic design, corporate feel, cheap look

### Friction Check (Each is a FAIL if present)
- Any corporate jargon? ("synergy", "optimize", "leverage")
- Any hedge words? ("maybe", "might", "could", "perhaps")
- Blank inputs without ghost text?
- No validation on inputs?
- Dense walls of text?
- Generic examples instead of specific?

## SCORING RULES
- Each criterion: 0-100 points
- Total score: Average of all 8 criteria
- PASS threshold: score >= 85 AND no critical issues
- Critical issue = any criterion below 60

## OUTPUT FORMAT
Return ONLY valid JSON:
{
  "result": "PASS" or "FAIL",
  "score": 0-100,
  "criteria_scores": {
    "forces_decision": 0-100,
    "zero_instructions": 0-100,
    "easy_first_steps": 0-100,
    "instant_feedback": 0-100,
    "gamification": 0-100,
    "visible_results": 0-100,
    "commitment_capture": 0-100,
    "fast_track_dna": 0-100
  },
  "critical_issues": ["issue that caused score < 60"],
  "issues": ["specific issue 1", "specific issue 2"],
  "recommendations": ["specific fix 1 with code example", "specific fix 2 with code example"],
  "friction_check": {
    "corporate_jargon": ["word1", "word2"] or [],
    "hedge_words": ["word1"] or [],
    "missing_ghost_text": ["input_id1"] or [],
    "missing_validation": ["input_id1"] or [],
    "dense_text_sections": ["section description"] or []
  }
}`;

// ========== INTERFACES ==========

export interface CriteriaScores {
  forces_decision: number;
  zero_instructions: number;
  easy_first_steps: number;
  instant_feedback: number;
  gamification: number;
  visible_results: number;
  commitment_capture: number;
  fast_track_dna: number;
}

export interface FrictionCheck {
  corporate_jargon: string[];
  hedge_words: string[];
  missing_ghost_text: string[];
  missing_validation: string[];
  dense_text_sections: string[];
}

export interface QAResult {
  result: 'PASS' | 'FAIL';
  score: number;
  criteria_scores: CriteriaScores;
  critical_issues: string[];
  issues: string[];
  recommendations: string[];
  friction_check: FrictionCheck;
}

// ========== AGENT FUNCTION ==========

/**
 * Run the QA Department agent to validate a tool
 * Uses DIFFERENT AI provider (Gemini by default) to avoid bias
 */
export async function runQA(toolHtml: string, spec: ToolSpec): Promise<QAResult> {
  console.log(`[QA] Validating "${spec.metadata.name}" with different AI model...`);

  const userMessage = `Validate this tool against the 8-point criteria.

## TOOL SPECIFICATION
${JSON.stringify(spec.metadata, null, 2)}

Category: ${spec.metadata.category}
Expected decision type: ${spec.verdict_rules.thresholds[0]?.verdict || 'GO/NO-GO'}

## TOOL HTML
${toolHtml}

Be ruthlessly critical. Find EVERY issue. The boss expects €20K quality.
Return ONLY valid JSON matching the output format.`;

  const response = await callAI(
    QA_SYSTEM_PROMPT,
    userMessage,
    {
      provider: getProviderForRole('qa'),  // Uses Gemini by default
      maxTokens: 4096
    }
  );

  // Parse JSON response
  try {
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const result = JSON.parse(jsonStr) as QAResult;

    // Validate structure
    if (!result.result || !result.score || !result.criteria_scores) {
      throw new Error('Missing required fields in QA result');
    }

    // Ensure result is PASS or FAIL
    if (result.result !== 'PASS' && result.result !== 'FAIL') {
      result.result = result.score >= 85 ? 'PASS' : 'FAIL';
    }

    console.log(`[QA] Result: ${result.result} (Score: ${result.score}/100)`);
    if (result.issues.length > 0) {
      console.log(`[QA] Issues found: ${result.issues.length}`);
    }

    return result;

  } catch (error) {
    console.error('[QA] Failed to parse response:', error);
    console.error('[QA] Raw response:', response.content.substring(0, 500) + '...');
    throw new Error(`QA failed to validate tool: ${error}`);
  }
}

/**
 * Check if QA result meets pass threshold
 */
export function meetsPassThreshold(result: QAResult): boolean {
  // Must have score >= 85
  if (result.score < 85) return false;

  // No criterion can be below 60 (critical issue)
  const scores = Object.values(result.criteria_scores);
  if (scores.some(score => score < 60)) return false;

  return true;
}

/**
 * Get summary of QA failures for feedback
 */
export function getQAFailureSummary(result: QAResult): string {
  const parts: string[] = [];

  // Overall score
  parts.push(`Overall Score: ${result.score}/100 (needs 85+)`);

  // Critical issues (scores < 60)
  for (const [criterion, score] of Object.entries(result.criteria_scores)) {
    if (score < 60) {
      parts.push(`CRITICAL: ${criterion} scored ${score}/100`);
    }
  }

  // Top issues
  if (result.issues.length > 0) {
    parts.push(`\nIssues to fix:`);
    result.issues.slice(0, 5).forEach((issue, i) => {
      parts.push(`${i + 1}. ${issue}`);
    });
  }

  return parts.join('\n');
}
