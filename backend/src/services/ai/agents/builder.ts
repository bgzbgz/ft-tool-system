/**
 * Fast Track Tool Builder Agent
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Creates detailed tool specifications from Secretary output
 */

import { callAI, getProviderForRole } from '../provider';
import { SecretaryOutput } from './secretary';

// ========== SYSTEM PROMPT ==========

const BUILDER_SYSTEM_PROMPT = `You are the Fast Track Tool Builder. You create world-class educational tools.

## THE 8-POINT CRITERIA (MANDATORY)
Every tool MUST satisfy ALL 8 points:
1. FORCES DECISION - Concrete outcome, not just thinking. User leaves with GO/NO-GO verdict.
2. ZERO INSTRUCTIONS - Self-evident. No "how to use" text. No confusion. No support needed.
3. EASY FIRST STEPS - Simple entry that builds confidence immediately.
4. INSTANT FEEDBACK - Every input shows immediate validation (like credit card fields turning red).
5. GAMIFICATION - Progress bars, scores, visual rewards that make progress feel exciting.
6. VISIBLE RESULTS - Crystal clear output showing exactly what user created.
7. COMMITMENT CAPTURE - Public commitment mechanism that creates accountability.
8. FAST TRACK DNA - Unmistakable brand identity. Gritty. Direct. Premium.

## BRAND DNA
- Brutal Honesty: No sugar-coating. Truth over comfort. Direct and clear.
- Obsessive 80/20: 20% of inputs drive 80% of outcomes. Ruthless prioritization.
- Die Empty: Full commitment or nothing. Total effort until job is done.

## TONE OF VOICE
DO:
- Short, sharp sentences
- Active tense ("We do" not "We will")
- Bold statements with confidence
- Day-to-day language (not corporate speak)

DON'T:
- Rambling or repetition
- Flowery metaphors
- Academic or fluffy language
- Hedge words (maybe, might, could, perhaps)

## FRICTION POINTS TO AVOID
❌ Corporate jargon ("synergy", "optimize", "leverage")
❌ Vague terms without definitions
❌ Instructions that need instructions
❌ Blank text boxes with no guidance
❌ No validation on inputs
❌ Allowing "The Team" instead of specific names
❌ No constraints (word limits, date pickers, etc.)
❌ Too many steps visible at once (use wizard flow)
❌ No progress indicator
❌ Dense walls of text
❌ Generic stock examples
❌ Ending with "things to consider" instead of verdict
❌ No commitment capture at the end

## FIXES THAT WORK
✅ Ghost text showing exactly what good input looks like
✅ Color-coded validation (green/yellow/red)
✅ Slot-based constraints ("You have 3 priority slots")
✅ Verb-first inputs for action items
✅ Progress bars and celebration moments
✅ Specific, relatable examples (not generic)

## OUTPUT FORMAT
Return a JSON specification with this structure:
{
  "metadata": {
    "name": "Tool Name",
    "slug": "tool-name",
    "category": "b2b_product | b2b_service | b2c_product | b2c_service",
    "tagline": "One punchy sentence",
    "estimated_time": "X minutes"
  },
  "wizard_steps": [
    {
      "step_number": 1,
      "title": "Step Title",
      "description": "Brief context (1 sentence max)",
      "questions": [
        {
          "id": "q1",
          "label": "Question text (no jargon)",
          "type": "text | textarea | number | range | select | radio | checkbox",
          "placeholder": "Ghost text example of good answer",
          "required": true,
          "validation": {
            "min_length": 10,
            "max_length": 200
          },
          "scoring": {
            "weight": 10,
            "criteria": "How this input affects the score"
          }
        }
      ]
    }
  ],
  "scoring": {
    "total_points": 100,
    "pass_threshold": 70,
    "categories": {
      "category_name": { "weight": 30, "questions": ["q1", "q2"] }
    }
  },
  "verdict_rules": {
    "thresholds": [
      { "min": 85, "verdict": "GO", "message": "Strong green light message" },
      { "min": 70, "verdict": "CONDITIONAL", "message": "Proceed with caution message" },
      { "min": 0, "verdict": "NO-GO", "message": "Clear stop message" }
    ]
  },
  "commitment_capture": {
    "enabled": true,
    "prompt": "Based on your results, what's ONE action you'll take this week?",
    "fields": [
      { "id": "action", "label": "I will...", "type": "text", "placeholder": "Schedule a call with..." },
      { "id": "deadline", "label": "By when?", "type": "date" }
    ]
  }
}`;

// ========== INTERFACES ==========

export interface Question {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'range' | 'select' | 'radio' | 'checkbox';
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  scoring?: {
    weight: number;
    criteria: string;
  };
}

export interface WizardStep {
  step_number: number;
  title: string;
  description: string;
  questions: Question[];
}

export interface ScoringConfig {
  total_points: number;
  pass_threshold: number;
  categories: Record<string, { weight: number; questions: string[] }>;
}

export interface VerdictRule {
  min: number;
  verdict: string;
  message: string;
}

export interface CommitmentCapture {
  enabled: boolean;
  prompt: string;
  fields: Array<{
    id: string;
    label: string;
    type: string;
    placeholder?: string;
  }>;
}

export interface ToolSpec {
  metadata: {
    name: string;
    slug: string;
    category: string;
    tagline: string;
    estimated_time: string;
  };
  wizard_steps: WizardStep[];
  scoring: ScoringConfig;
  verdict_rules: {
    thresholds: VerdictRule[];
  };
  commitment_capture: CommitmentCapture;
}

// ========== AGENT FUNCTION ==========

/**
 * Run the Tool Builder agent to create a detailed specification
 */
export async function runBuilder(
  secretaryOutput: SecretaryOutput,
  originalBossInput: string
): Promise<ToolSpec> {
  console.log(`[Builder] Creating spec for "${secretaryOutput.tool_name}"...`);

  const userMessage = `## SECRETARY ANALYSIS
${JSON.stringify(secretaryOutput, null, 2)}

## ORIGINAL BOSS REQUEST
${originalBossInput}

Create a complete tool specification that:
1. Has ${secretaryOutput.estimated_questions || 7} questions across 3-5 wizard steps
2. Uses the decision type: ${secretaryOutput.decision_type}
3. Targets: ${secretaryOutput.target_audience}
4. Addresses these requirements: ${secretaryOutput.key_requirements.join(', ')}

Return ONLY valid JSON matching the output format.`;

  const response = await callAI(
    BUILDER_SYSTEM_PROMPT,
    userMessage,
    { provider: getProviderForRole('primary') }
  );

  // Parse JSON response
  try {
    let jsonStr = response.content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const spec = JSON.parse(jsonStr) as ToolSpec;

    // Validate structure
    if (!spec.metadata || !spec.wizard_steps || !spec.scoring || !spec.verdict_rules) {
      throw new Error('Missing required sections in tool spec');
    }

    if (spec.wizard_steps.length === 0) {
      throw new Error('Tool spec must have at least one wizard step');
    }

    console.log(`[Builder] Created spec with ${spec.wizard_steps.length} steps, ${countQuestions(spec)} questions`);
    return spec;

  } catch (error) {
    console.error('[Builder] Failed to parse response:', error);
    console.error('[Builder] Raw response:', response.content.substring(0, 500) + '...');
    throw new Error(`Builder failed to create tool spec: ${error}`);
  }
}

/**
 * Count total questions in a spec
 */
function countQuestions(spec: ToolSpec): number {
  return spec.wizard_steps.reduce((sum, step) => sum + step.questions.length, 0);
}
