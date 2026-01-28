/**
 * Fast Track Feedback Applier Agent
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Fixes tools that failed QA validation
 */

import { callAI, getProviderForRole } from '../provider';
import { QAResult, getQAFailureSummary } from './qa';

// ========== SYSTEM PROMPT ==========

const FEEDBACK_APPLIER_SYSTEM_PROMPT = `You are the Fast Track Feedback Applier. You fix tools that failed QA.

## YOUR JOB
1. Read the QA report issues and recommendations
2. Apply EACH fix to the HTML
3. Do NOT introduce new issues
4. Maintain Fast Track DNA throughout

## COMMON FIXES

### Forces Decision
- Add clear verdict section with GO/NO-GO
- Remove wishy-washy language
- Make the final message bold and actionable

### Zero Instructions
- Remove any "how to use" text
- Replace jargon with plain language
- Make labels self-explanatory

### Easy First Steps
- Simplify first question
- Add ghost text placeholder
- Make it achievable in 10 seconds

### Instant Feedback
- Add input validation with visual states
- Show green checkmark on valid input
- Show red border and error on invalid

### Gamification
- Add progress bar if missing
- Add celebration on completion
- Show score updates

### Visible Results
- Make verdict large and clear
- Add export/share functionality
- Show breakdown of score

### Commitment Capture
- Add "I will [action] by [date]" section
- Make it feel important, not optional
- Add accountability mechanism

### Fast Track DNA
- Use black/white primary colors
- Add yellow (#FFF469) accent sparingly
- Bold typography, premium feel
- Remove any generic/corporate styling

## CRITICAL RULES
- Fix ALL issues mentioned in the QA report
- Do not break existing functionality
- Do not add new features not in the spec
- Keep all CSS and JS inline (single file)

## OUTPUT
Return ONLY the fixed HTML file. No explanations. No markdown.
Start with <!DOCTYPE html> and end with </html>.`;

// ========== AGENT FUNCTION ==========

/**
 * Run the Feedback Applier agent to fix QA issues
 */
export async function runFeedbackApplier(
  toolHtml: string,
  qaResult: QAResult,
  attemptNumber: number
): Promise<string> {
  console.log(`[FeedbackApplier] Fixing issues (attempt ${attemptNumber})...`);

  const failureSummary = getQAFailureSummary(qaResult);

  const userMessage = `Fix this tool that failed QA validation.

## QA RESULT
Score: ${qaResult.score}/100
Result: ${qaResult.result}

## FAILURE SUMMARY
${failureSummary}

## DETAILED ISSUES
${qaResult.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

## RECOMMENDATIONS FROM QA
${qaResult.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

## FRICTION CHECK FINDINGS
- Corporate jargon found: ${qaResult.friction_check.corporate_jargon.join(', ') || 'none'}
- Hedge words found: ${qaResult.friction_check.hedge_words.join(', ') || 'none'}
- Missing ghost text: ${qaResult.friction_check.missing_ghost_text.join(', ') || 'none'}
- Missing validation: ${qaResult.friction_check.missing_validation.join(', ') || 'none'}

## CRITERIA SCORES
${Object.entries(qaResult.criteria_scores)
  .map(([criterion, score]) => `- ${criterion}: ${score}/100${score < 60 ? ' (CRITICAL)' : score < 85 ? ' (NEEDS WORK)' : ''}`)
  .join('\n')}

## CURRENT HTML
${toolHtml}

Fix ALL issues and return the complete fixed HTML.
Start with <!DOCTYPE html>.`;

  const response = await callAI(
    FEEDBACK_APPLIER_SYSTEM_PROMPT,
    userMessage,
    {
      provider: getProviderForRole('primary'),
      maxTokens: 16384  // HTML can be large
    }
  );

  let html = response.content.trim();

  // Clean up potential markdown wrapping
  if (html.startsWith('```')) {
    html = html.replace(/```html?\n?/g, '').replace(/```$/g, '').trim();
  }

  // Validate HTML structure
  if (!html.startsWith('<!DOCTYPE html>') && !html.startsWith('<html')) {
    throw new Error('Feedback Applier did not return valid HTML');
  }

  if (!html.includes('</html>')) {
    throw new Error('Feedback Applier returned incomplete HTML');
  }

  // Log changes
  const sizeDiff = html.length - toolHtml.length;
  console.log(`[FeedbackApplier] Fixed HTML (${sizeDiff > 0 ? '+' : ''}${sizeDiff} bytes)`);

  return html;
}

/**
 * Apply boss revision feedback (different from QA fixes)
 * Boss word is law - prioritize boss feedback over QA
 */
export async function applyBossRevision(
  toolHtml: string,
  bossNotes: string
): Promise<string> {
  console.log('[FeedbackApplier] Applying boss revision...');

  const userMessage = `The boss has requested changes to this tool. BOSS WORD IS LAW.

## BOSS REVISION NOTES
${bossNotes}

## CURRENT HTML
${toolHtml}

Apply the boss's requested changes exactly as specified.
Maintain Fast Track DNA and quality standards.
Return the complete fixed HTML.
Start with <!DOCTYPE html>.`;

  const response = await callAI(
    FEEDBACK_APPLIER_SYSTEM_PROMPT,
    userMessage,
    {
      provider: getProviderForRole('primary'),
      maxTokens: 16384
    }
  );

  let html = response.content.trim();

  if (html.startsWith('```')) {
    html = html.replace(/```html?\n?/g, '').replace(/```$/g, '').trim();
  }

  if (!html.startsWith('<!DOCTYPE html>') && !html.startsWith('<html')) {
    throw new Error('Feedback Applier did not return valid HTML for boss revision');
  }

  console.log('[FeedbackApplier] Boss revision applied');
  return html;
}
