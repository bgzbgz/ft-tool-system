/**
 * Fast Track AI Pipeline Service
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Orchestrates the 5-agent tool generation flow
 */

import { runSecretary, SecretaryOutput } from './agents/secretary';
import { runBuilder, ToolSpec } from './agents/builder';
import { runTemplateDecider } from './agents/templateDecider';
import { runQA, QAResult, meetsPassThreshold } from './agents/qa';
import { runFeedbackApplier } from './agents/feedbackApplier';
import { checkAIConfiguration } from './provider';

// ========== CONFIGURATION ==========

const MAX_QA_RETRIES = parseInt(process.env.AI_MAX_RETRIES || '3');

// ========== INTERFACES ==========

export interface PipelineInput {
  jobId: string;
  sourceText: string;
  fileMetadata: {
    filename: string;
    fileType: string;
  };
}

export interface RevisionEntry {
  attempt: number;
  score: number;
  passed: boolean;
  issues: string[];
}

export interface PipelineResult {
  success: boolean;
  toolHtml?: string;
  toolName?: string;
  toolSlug?: string;
  toolDescription?: string;
  category?: string;
  qaReport?: QAResult;
  revisionCount: number;
  revisionHistory: RevisionEntry[];
  spec?: ToolSpec;
  error?: string;
}

export type PipelineStage =
  | 'initializing'
  | 'secretary'
  | 'builder'
  | 'template'
  | 'qa'
  | 'feedback'
  | 'complete'
  | 'failed';

export interface PipelineProgress {
  stage: PipelineStage;
  message: string;
  attempt?: number;
  maxAttempts?: number;
  score?: number;
}

export type ProgressCallback = (progress: PipelineProgress) => void;

// ========== PIPELINE FUNCTION ==========

/**
 * Run the complete tool generation pipeline
 *
 * Flow:
 * 1. Secretary: Parse boss request
 * 2. Builder: Create tool specification
 * 3. Template Decider: Generate HTML
 * 4. QA: Validate against 8-point criteria
 * 5. Feedback Applier: Fix issues (if QA fails, up to MAX_RETRIES)
 */
export async function runToolPipeline(
  input: PipelineInput,
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const revisionHistory: RevisionEntry[] = [];
  let revisionCount = 0;

  // Helper to report progress
  const progress = (stage: PipelineStage, message: string, extra?: Partial<PipelineProgress>) => {
    if (onProgress) {
      onProgress({ stage, message, ...extra });
    }
    console.log(`[Pipeline] ${stage}: ${message}`);
  };

  try {
    // Check AI configuration
    progress('initializing', 'Checking AI configuration...');
    const configCheck = checkAIConfiguration();
    if (!configCheck.valid) {
      throw new Error(`AI not configured: Missing ${configCheck.missing.join(', ')}`);
    }

    // ========== STAGE 1: SECRETARY ==========
    progress('secretary', 'Understanding your request...');

    const secretaryOutput: SecretaryOutput = await runSecretary(input.sourceText);

    progress('secretary', `Identified: "${secretaryOutput.tool_name}" (${secretaryOutput.category})`);

    // ========== STAGE 2: BUILDER ==========
    progress('builder', 'Creating tool specification...');

    const spec: ToolSpec = await runBuilder(secretaryOutput, input.sourceText);

    const questionCount = spec.wizard_steps.reduce((sum, step) => sum + step.questions.length, 0);
    progress('builder', `Spec created: ${spec.wizard_steps.length} steps, ${questionCount} questions`);

    // ========== STAGE 3: TEMPLATE DECIDER ==========
    progress('template', 'Building HTML...');

    let toolHtml: string = await runTemplateDecider(spec);

    progress('template', `HTML generated (${Math.round(toolHtml.length / 1024)}KB)`);

    // ========== STAGE 4 & 5: QA + FEEDBACK LOOP ==========
    let qaResult: QAResult;
    let passed = false;

    for (let attempt = 1; attempt <= MAX_QA_RETRIES; attempt++) {
      revisionCount = attempt;

      progress('qa', `Validating against 8-point criteria...`, {
        attempt,
        maxAttempts: MAX_QA_RETRIES
      });

      qaResult = await runQA(toolHtml, spec);

      // Record this attempt
      revisionHistory.push({
        attempt,
        score: qaResult.score,
        passed: qaResult.result === 'PASS',
        issues: qaResult.issues.slice(0, 5)  // Top 5 issues
      });

      progress('qa', `Score: ${qaResult.score}/100 - ${qaResult.result}`, {
        attempt,
        maxAttempts: MAX_QA_RETRIES,
        score: qaResult.score
      });

      // Check if passed
      if (meetsPassThreshold(qaResult)) {
        passed = true;
        break;
      }

      // If not passed and more attempts available, apply fixes
      if (attempt < MAX_QA_RETRIES) {
        progress('feedback', `Applying fixes (attempt ${attempt} of ${MAX_QA_RETRIES})...`, {
          attempt,
          maxAttempts: MAX_QA_RETRIES
        });

        toolHtml = await runFeedbackApplier(toolHtml, qaResult, attempt);

        progress('feedback', 'Fixes applied, re-validating...');
      }
    }

    // ========== RESULT ==========
    if (passed) {
      progress('complete', `Tool generated successfully! Score: ${qaResult!.score}/100`);

      return {
        success: true,
        toolHtml,
        toolName: spec.metadata.name,
        toolSlug: spec.metadata.slug,
        toolDescription: spec.metadata.tagline,
        category: spec.metadata.category,
        qaReport: qaResult!,
        revisionCount,
        revisionHistory,
        spec
      };
    } else {
      progress('failed', `Tool failed QA after ${MAX_QA_RETRIES} attempts. Final score: ${qaResult!.score}/100`);

      return {
        success: false,
        toolHtml,  // Return last attempt anyway
        toolName: spec.metadata.name,
        toolSlug: spec.metadata.slug,
        toolDescription: spec.metadata.tagline,
        category: spec.metadata.category,
        qaReport: qaResult!,
        revisionCount,
        revisionHistory,
        spec,
        error: `Tool failed QA after ${MAX_QA_RETRIES} attempts. Final score: ${qaResult!.score}/100`
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    progress('failed', `Pipeline error: ${errorMessage}`);

    return {
      success: false,
      revisionCount,
      revisionHistory,
      error: errorMessage
    };
  }
}

/**
 * Run pipeline with Server-Sent Events progress updates
 * Returns an async generator for streaming progress
 */
export async function* runToolPipelineStreaming(
  input: PipelineInput
): AsyncGenerator<PipelineProgress, PipelineResult, void> {
  const progressEvents: PipelineProgress[] = [];
  let finalResult: PipelineResult | null = null;

  // Create a promise that resolves when pipeline completes
  const pipelinePromise = runToolPipeline(input, (progress) => {
    progressEvents.push(progress);
  }).then(result => {
    finalResult = result;
  });

  // Yield progress events as they come in
  let lastIndex = 0;
  while (!finalResult) {
    // Yield any new progress events
    while (lastIndex < progressEvents.length) {
      yield progressEvents[lastIndex];
      lastIndex++;
    }

    // Small delay before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Yield any remaining progress events
  while (lastIndex < progressEvents.length) {
    yield progressEvents[lastIndex];
    lastIndex++;
  }

  return finalResult;
}

/**
 * Estimate pipeline duration based on input size
 */
export function estimatePipelineDuration(inputLength: number): {
  minSeconds: number;
  maxSeconds: number;
  stages: Record<PipelineStage, number>;
} {
  // Base times per stage (in seconds)
  const baseTimes: Record<PipelineStage, number> = {
    initializing: 1,
    secretary: 5,
    builder: 15,
    template: 20,
    qa: 10,
    feedback: 15,
    complete: 0,
    failed: 0
  };

  // Adjust based on input size
  const sizeFactor = Math.max(1, inputLength / 5000);

  const stages: Record<PipelineStage, number> = {} as Record<PipelineStage, number>;
  let total = 0;

  for (const [stage, baseTime] of Object.entries(baseTimes)) {
    const adjusted = Math.round(baseTime * sizeFactor);
    stages[stage as PipelineStage] = adjusted;
    total += adjusted;
  }

  return {
    minSeconds: total,
    maxSeconds: total * MAX_QA_RETRIES,  // Worst case: all retries
    stages
  };
}
