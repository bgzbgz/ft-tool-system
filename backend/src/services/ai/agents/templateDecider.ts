/**
 * Fast Track Template Decider Agent
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Selects template and generates complete HTML tool
 */

import { callAI, getProviderForRole } from '../provider';
import { ToolSpec } from './builder';

// ========== SYSTEM PROMPT ==========

const TEMPLATE_DECIDER_SYSTEM_PROMPT = `You are the Fast Track Template Decider. You build complete HTML tools from specifications.

## HTML REQUIREMENTS
All tools must be:
1. SINGLE FILE - All CSS and JS inline, no external dependencies
2. MOBILE RESPONSIVE - Works on 320px width
3. FAST TRACK BRANDED - Black/white primary, yellow accent (#FFF469)
4. SELF-CONTAINED - No instructions needed
5. GAMIFIED - Progress bars, celebrations, visual feedback

## DESIGN SYSTEM

### Colors
- Primary: #000000 (black), #FFFFFF (white)
- Accent: #FFF469 (yellow) - used sparingly for highlights
- Success: #10B981 (green)
- Warning: #F59E0B (amber)
- Danger: #EF4444 (red)
- Gray: #6B7280 (muted text)

### Typography
- Font: Inter, -apple-system, sans-serif
- Headlines: Bold, may be uppercase
- Body: 16px base, clean and readable

### Spacing
- Base unit: 8px
- Border radius: 8px
- Card padding: 24px

## HTML STRUCTURE
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Tool Name] | Fast Track</title>
  <style>
    /* All styles inline */
  </style>
</head>
<body>
  <div class="ft-tool" data-category="[category]">
    <!-- Header with tool name and progress -->
    <header class="ft-header">
      <h1>[Tool Name]</h1>
      <p class="ft-tagline">[Tagline]</p>
      <div class="ft-progress">
        <div class="ft-progress-bar" style="width: 0%"></div>
        <span class="ft-progress-text">Step 1 of X</span>
      </div>
    </header>

    <!-- Wizard Steps (one visible at a time) -->
    <main class="ft-main">
      <section class="ft-step" data-step="1">
        <!-- Questions for step 1 -->
      </section>
      <section class="ft-step" data-step="2" hidden>
        <!-- Questions for step 2 -->
      </section>
      <!-- More steps... -->
    </main>

    <!-- Navigation -->
    <nav class="ft-nav">
      <button class="ft-btn ft-btn-secondary" id="prevBtn" hidden>Back</button>
      <button class="ft-btn ft-btn-primary" id="nextBtn">Continue</button>
    </nav>

    <!-- Verdict (hidden until complete) -->
    <section class="ft-verdict" hidden>
      <div class="ft-verdict-score"></div>
      <div class="ft-verdict-message"></div>
      <div class="ft-verdict-details"></div>
    </section>

    <!-- Commitment Capture (after verdict) -->
    <section class="ft-commitment" hidden>
      <!-- Commitment form -->
    </section>
  </div>

  <script>
    /* All JavaScript inline */
  </script>
</body>
</html>
\`\`\`

## REQUIRED FEATURES

### Progress Bar
- Updates on each step
- Shows "Step X of Y"
- Yellow fill on black background

### Instant Validation
- Inputs show red border when invalid
- Green checkmark when valid
- Error messages appear immediately

### Scoring Engine
- Calculate score from all inputs
- Apply weights per spec
- Show running score (optional) or final only

### Verdict Display
- Large, bold verdict text
- Color-coded (green/yellow/red)
- Clear explanation
- Specific next steps

### Commitment Capture
- Simple form after verdict
- "I will [action] by [date]"
- Optional share functionality

### Celebration
- Visual celebration on completion
- Confetti or similar effect
- Reinforces achievement

## OUTPUT
Return ONLY the complete HTML file. No explanations. No markdown code blocks.
Start with <!DOCTYPE html> and end with </html>.`;

// ========== AGENT FUNCTION ==========

/**
 * Run the Template Decider agent to generate HTML
 */
export async function runTemplateDecider(spec: ToolSpec): Promise<string> {
  console.log(`[TemplateDecider] Generating HTML for "${spec.metadata.name}"...`);

  const userMessage = `Generate a complete, production-ready HTML tool from this specification:

${JSON.stringify(spec, null, 2)}

Requirements:
- Category: ${spec.metadata.category}
- Steps: ${spec.wizard_steps.length}
- Questions: ${spec.wizard_steps.reduce((sum, s) => sum + s.questions.length, 0)}
- Decision type based on verdict rules

Return ONLY the HTML. Start with <!DOCTYPE html>.`;

  const response = await callAI(
    TEMPLATE_DECIDER_SYSTEM_PROMPT,
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
    throw new Error('Template Decider did not return valid HTML');
  }

  if (!html.includes('</html>')) {
    throw new Error('Template Decider returned incomplete HTML');
  }

  console.log(`[TemplateDecider] Generated ${html.length} bytes of HTML`);
  return html;
}

/**
 * Inject additional styles or scripts into generated HTML
 */
export function injectIntoHtml(html: string, injection: {
  styles?: string;
  scripts?: string;
  headContent?: string;
}): string {
  let result = html;

  if (injection.styles) {
    result = result.replace('</style>', `${injection.styles}\n</style>`);
  }

  if (injection.scripts) {
    result = result.replace('</script>', `${injection.scripts}\n</script>`);
  }

  if (injection.headContent) {
    result = result.replace('</head>', `${injection.headContent}\n</head>`);
  }

  return result;
}
