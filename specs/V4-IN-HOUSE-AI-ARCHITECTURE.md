# V4 In-House AI Architecture

> **Purpose**: Replace n8n with native backend AI processing
> **Status**: SPEC DRAFT
> **Eliminates**: n8n dependency, external webhook latency, callback complexity

---

## Overview

This spec restructures the backend from an "API sponge" (frontend → backend → n8n → callback) to a self-contained AI processing pipeline (frontend → backend with embedded AI agents).

### Current Architecture (n8n Dependent)

```
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌─────────┐
│Frontend │───▶│ Backend │───▶│ n8n Webhook │───▶│ Callback│
└─────────┘    └─────────┘    └─────────────┘    └─────────┘
                    │               │                  │
                    │    5 AI Agents in n8n           │
                    │    (Secretary, Builder,         │
                    │     Template, QA, Feedback)     │
                    │◀─────────────────────────────────┘
```

### New Architecture (In-House)

```
┌─────────┐    ┌──────────────────────────────────────────┐
│Frontend │───▶│                 Backend                  │
└─────────┘    │  ┌─────────────────────────────────────┐ │
               │  │         AI Pipeline Service          │ │
               │  │  ┌─────┐ ┌───────┐ ┌────────────┐   │ │
               │  │  │Secr.│▶│Builder│▶│Template    │   │ │
               │  │  └─────┘ └───────┘ │ Decider    │   │ │
               │  │                    └────────────┘   │ │
               │  │                         │           │ │
               │  │  ┌──────┐              ▼           │ │
               │  │  │Feedbk│◀────────┌────────┐       │ │
               │  │  │Applir│         │   QA   │       │ │
               │  │  └──────┘────────▶│  Dept  │       │ │
               │  │        (if fail)  └────────┘       │ │
               │  └─────────────────────────────────────┘ │
               └──────────────────────────────────────────┘
```

---

## New Service Layer

### 1. AI Provider Service (`/services/ai/provider.ts`)

Manages API connections to Claude and Gemini.

```typescript
// Configuration
interface AIProviderConfig {
  claude: {
    apiKey: string;
    model: 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022';
    maxTokens: number;
    temperature: number;
  };
  gemini: {
    apiKey: string;
    model: 'gemini-2.0-flash' | 'gemini-1.5-pro';
    maxTokens: number;
    temperature: number;
  };
}

// Core function
async function callAI(
  provider: 'claude' | 'gemini',
  systemPrompt: string,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<AIResponse>;

// Response interface
interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  latencyMs: number;
}
```

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
AI_PRIMARY_PROVIDER=claude    # Default provider
AI_QA_PROVIDER=gemini         # Different model for QA (no bias)
```

---

### 2. Agent Pipeline Service (`/services/ai/pipeline.ts`)

Orchestrates the 5-agent tool generation flow.

```typescript
interface PipelineInput {
  jobId: string;
  sourceText: string;        // Boss's specification/instructions
  fileMetadata: {
    filename: string;
    fileType: string;
  };
}

interface PipelineResult {
  success: boolean;
  toolHtml?: string;
  toolName?: string;
  toolDescription?: string;
  qaReport?: QAReport;
  revisionCount: number;
  revisionHistory: RevisionEntry[];
  error?: string;
}

async function runToolPipeline(input: PipelineInput): Promise<PipelineResult>;
```

**Pipeline Flow:**
```
1. Secretary Agent    → Understands and normalizes boss request
2. Tool Builder Agent → Creates detailed Markdown specification
3. Template Decider   → Selects template + generates HTML
4. QA Department      → Validates against 8-point criteria (different AI model)
5. Feedback Applier   → Fixes issues if QA fails (max 3 attempts)
```

---

### 3. Individual Agent Modules

Each agent is a module with embedded system prompt (from `V4-COMPRESSED-PROMPTS.md`).

#### 3.1 Secretary Agent (`/services/ai/agents/secretary.ts`)

```typescript
const SECRETARY_SYSTEM_PROMPT = `
You are the Fast Track Secretary. Your job is to:
1. Parse and understand the boss's tool request
2. Extract key requirements: tool type, category, target audience
3. Identify the decision type (GO/NO-GO, HIRE/DON'T HIRE, etc.)
4. Normalize the request into a structured format

Output JSON:
{
  "tool_name": "string",
  "category": "b2b_product | b2b_service | b2c_product | b2c_service",
  "decision_type": "GO/NO-GO | HIRE/DON'T HIRE | BUY NOW/WAIT/SKIP | COMMIT/NOT READY",
  "target_audience": "string",
  "key_requirements": ["string"],
  "context_summary": "string"
}
`;

interface SecretaryOutput {
  toolName: string;
  category: ToolCategory;
  decisionType: string;
  targetAudience: string;
  keyRequirements: string[];
  contextSummary: string;
}

async function runSecretary(bossInput: string): Promise<SecretaryOutput>;
```

#### 3.2 Tool Builder Agent (`/services/ai/agents/builder.ts`)

```typescript
const BUILDER_SYSTEM_PROMPT = `
You are the Fast Track Tool Builder. You create world-class educational tools.

## THE 8-POINT CRITERIA (MANDATORY)
Every tool MUST satisfy ALL 8 points:
1. FORCES DECISION - Concrete outcome, not just thinking
2. ZERO INSTRUCTIONS - Self-evident, no "how to use" text
3. EASY FIRST STEPS - Simple entry that builds confidence
4. INSTANT FEEDBACK - Every input shows immediate validation
5. GAMIFICATION - Progress bars, scores, visual rewards
6. VISIBLE RESULTS - Crystal clear output
7. COMMITMENT CAPTURE - Public commitment mechanism
8. FAST TRACK DNA - Gritty, direct, premium feel

## BRAND DNA
- Brutal Honesty: No sugar-coating. Truth over comfort.
- Obsessive 80/20: Focus on the 20% that matters.
- Die Empty: Full commitment until job is done.

## TONE
- Short, sharp sentences
- Active tense ("Do this" not "You should consider")
- Day-to-day language, not corporate speak
- NEVER use hedge words (maybe, might, could, perhaps)

## OUTPUT FORMAT
Create a complete Markdown specification including:
1. Tool metadata (name, slug, category, tagline)
2. All questions/inputs with ghost text examples
3. Scoring logic for each input
4. Verdict calculation rules (thresholds)
5. UI sections and flow (wizard steps)
6. Commitment capture mechanism
7. Export/share functionality
`;

interface ToolSpec {
  metadata: {
    name: string;
    slug: string;
    category: string;
    tagline: string;
    estimatedTime: string;
  };
  questions: Question[];
  scoring: ScoringLogic;
  verdictRules: VerdictRules;
  uiFlow: UISection[];
  commitmentCapture: CommitmentConfig;
}

async function runBuilder(secretaryOutput: SecretaryOutput, bossInput: string): Promise<ToolSpec>;
```

#### 3.3 Template Decider Agent (`/services/ai/agents/templateDecider.ts`)

```typescript
const TEMPLATE_DECIDER_SYSTEM_PROMPT = `
You are the Fast Track Template Decider. You select the right template and build HTML.

## TEMPLATE SELECTION RULES
Based on category, select template:
- b2b_product → ROI calculator, TCO analysis, integration checklist
- b2b_service → Fit assessment, red flags, negotiation priorities
- b2c_product → Needs vs wants, budget check, timing advisor
- b2c_service → Readiness meter, commitment tracker, goal alignment

## HTML REQUIREMENTS
All tools must be:
1. SINGLE FILE - All CSS and JS inline, no external dependencies
2. MOBILE RESPONSIVE - Works on 320px width
3. FAST TRACK BRANDED - Black/white primary, yellow accent (#FFF469)
4. SELF-CONTAINED - No instructions needed
5. GAMIFIED - Progress bars, celebrations, visual feedback

## OUTPUT
Return ONLY the complete HTML file. No explanations. No markdown.
`;

async function runTemplateDecider(toolSpec: ToolSpec): Promise<string>; // Returns HTML
```

#### 3.4 QA Department Agent (`/services/ai/agents/qa.ts`)

**IMPORTANT**: Uses DIFFERENT AI provider (Gemini) to avoid bias.

```typescript
const QA_SYSTEM_PROMPT = `
You are the Fast Track QA Department. You validate tools against strict criteria.

YOU USE A DIFFERENT AI MODEL TO ENSURE NO BIAS.

## VALIDATION CHECKLIST

### 8-Point Criteria (Each scored 0-100)
1. FORCES DECISION: Does tool end with concrete verdict?
2. ZERO INSTRUCTIONS: Is it self-evident?
3. EASY FIRST STEPS: Does first input feel achievable in <10 seconds?
4. INSTANT FEEDBACK: Does every input show immediate response?
5. GAMIFICATION: Are there progress bars, scores, celebrations?
6. VISIBLE RESULTS: Is output crystal clear and exportable?
7. COMMITMENT CAPTURE: Is there a specific "I will do X by Y" mechanism?
8. FAST TRACK DNA: Does it feel €20K premium? Bold? Direct? Gritty?

### Friction Check
- Any corporate jargon? (FAIL)
- Any hedge words? (FAIL)
- Blank inputs without ghost text? (FAIL)
- No validation on inputs? (FAIL)
- Dense walls of text? (FAIL)

## OUTPUT FORMAT
{
  "result": "PASS" or "FAIL",
  "score": 0-100,
  "criteria_scores": { ... },
  "issues": ["specific issue 1", "specific issue 2"],
  "recommendations": ["specific fix 1", "specific fix 2"]
}

PASS THRESHOLD: score >= 85 AND no critical issues
`;

interface QAResult {
  result: 'PASS' | 'FAIL';
  score: number;
  criteriaScores: Record<string, number>;
  issues: string[];
  recommendations: string[];
}

async function runQA(toolHtml: string, toolSpec: ToolSpec): Promise<QAResult>;
```

#### 3.5 Feedback Applier Agent (`/services/ai/agents/feedbackApplier.ts`)

```typescript
const FEEDBACK_APPLIER_SYSTEM_PROMPT = `
You are the Fast Track Feedback Applier. You fix tools that failed QA.

## YOUR JOB
1. Read the QA report issues and recommendations
2. Apply EACH fix to the HTML
3. Do NOT introduce new issues
4. Maintain Fast Track DNA throughout

## OUTPUT
Return ONLY the fixed HTML file. No explanations.
`;

async function runFeedbackApplier(
  toolHtml: string,
  qaReport: QAResult
): Promise<string>; // Returns fixed HTML
```

---

### 4. Template Engine (`/services/templates/`)

Store template HTML files in the codebase (not fetched from external sources).

```
/backend/src/templates/
├── base/
│   └── tool-shell.html       # Base HTML structure
├── categories/
│   ├── b2b-product.html      # ROI calculator pattern
│   ├── b2b-service.html      # Fit assessment pattern
│   ├── b2c-product.html      # Needs vs wants pattern
│   └── b2c-service.html      # Readiness meter pattern
├── components/
│   ├── progress-bar.html
│   ├── wizard-step.html
│   ├── verdict-display.html
│   ├── commitment-capture.html
│   └── celebration-modal.html
└── styles/
    └── fast-track.css        # Brand styles (inlined during build)
```

```typescript
// Template service
interface TemplateService {
  getBaseShell(): string;
  getCategoryTemplate(category: ToolCategory): string;
  getComponent(name: string): string;
  inlineStyles(html: string): string;
}
```

---

## Modified Backend Services

### Update `factory.ts` → `toolGenerator.ts`

**Before (n8n webhook):**
```typescript
async function submitJobToFactory(job: Job): Promise<SubmitResult> {
  // Sends to n8n webhook, waits for callback
}
```

**After (in-house):**
```typescript
async function generateTool(job: Job): Promise<GenerateResult> {
  // 1. Get file content
  const fileContent = await retrieveFile(job.file_storage_key);

  // 2. Run AI pipeline
  const pipelineResult = await runToolPipeline({
    jobId: job.job_id,
    sourceText: fileContent.toString('utf-8'),
    fileMetadata: {
      filename: job.original_filename,
      fileType: job.file_type
    }
  });

  // 3. Return result (no callback needed)
  return {
    success: pipelineResult.success,
    toolHtml: pipelineResult.toolHtml,
    toolName: pipelineResult.toolName,
    qaReport: pipelineResult.qaReport,
    revisionCount: pipelineResult.revisionCount
  };
}
```

### Remove `callback.ts`

No longer needed - processing is synchronous within the backend.

### Update Job Flow

**Before:**
```
DRAFT → SENT → [wait for callback] → READY_FOR_REVIEW/FACTORY_FAILED
```

**After:**
```
DRAFT → PROCESSING → READY_FOR_REVIEW/FACTORY_FAILED
```

Add new status:
```typescript
enum JobStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',     // NEW: AI pipeline running
  // SENT removed - no external submission
  FACTORY_FAILED = 'FACTORY_FAILED',
  READY_FOR_REVIEW = 'READY_FOR_REVIEW',
  // ... rest unchanged
}
```

---

## API Changes

### POST `/api/jobs/:id/generate`

Replaces the webhook submission + callback flow.

```typescript
// Request: none (job already has file)

// Response (SSE stream for progress):
event: progress
data: {"stage": "secretary", "message": "Understanding your request..."}

event: progress
data: {"stage": "builder", "message": "Creating tool specification..."}

event: progress
data: {"stage": "template", "message": "Building HTML..."}

event: progress
data: {"stage": "qa", "message": "Validating against 8-point criteria..."}

event: progress
data: {"stage": "qa", "message": "QA Score: 72/100 - Applying fixes..."}

event: progress
data: {"stage": "feedback", "message": "Revision 1 of 3..."}

event: complete
data: {"success": true, "tool_name": "...", "qa_score": 87}

// Or on failure after max retries:
event: failed
data: {"error": "Tool failed QA after 3 attempts", "final_score": 68}
```

---

## Environment Variables

```bash
# AI Providers
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_AI_API_KEY=AIza...

# Provider Selection
AI_PRIMARY_PROVIDER=claude           # For Secretary, Builder, Template, Feedback
AI_QA_PROVIDER=gemini                # For QA (different model = no bias)

# Model Selection
CLAUDE_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-2.0-flash

# Pipeline Config
AI_MAX_RETRIES=3                     # Max QA revision attempts
AI_TIMEOUT_MS=120000                 # Per-agent timeout
AI_MAX_TOKENS=8192                   # Max output tokens

# Rate Limiting
AI_RATE_LIMIT_RPM=50                 # Requests per minute
AI_RATE_LIMIT_TPM=100000             # Tokens per minute
```

---

## File Structure Changes

```
/backend/src/
├── services/
│   ├── ai/
│   │   ├── provider.ts              # NEW: AI API wrapper
│   │   ├── pipeline.ts              # NEW: 5-agent orchestration
│   │   └── agents/
│   │       ├── secretary.ts         # NEW
│   │       ├── builder.ts           # NEW
│   │       ├── templateDecider.ts   # NEW
│   │       ├── qa.ts                # NEW
│   │       └── feedbackApplier.ts   # NEW
│   ├── templates/
│   │   └── engine.ts                # NEW: Template loading/merging
│   ├── toolGenerator.ts             # RENAMED from factory.ts
│   ├── stateMachine.ts              # MODIFIED: Add PROCESSING status
│   ├── jobStore.ts                  # UNCHANGED
│   ├── storage.ts                   # UNCHANGED
│   ├── github.ts                    # UNCHANGED
│   ├── deploy.ts                    # UNCHANGED
│   ├── learnworlds.ts               # UNCHANGED
│   └── toolDatabase.ts              # UNCHANGED
│   # DELETED: callback.ts (no longer needed)
├── templates/                        # NEW: HTML templates
│   ├── base/
│   ├── categories/
│   ├── components/
│   └── styles/
├── routes/
│   ├── jobs.ts                      # MODIFIED: Add /generate endpoint
│   # DELETED: factory.ts callback route
```

---

## Migration Path

### Phase 1: Add AI Service Layer
1. Create `/services/ai/provider.ts`
2. Add environment variables
3. Test with simple prompts

### Phase 2: Implement Agents
1. Create each agent module with embedded prompts
2. Test individually with sample inputs
3. Validate outputs match n8n results

### Phase 3: Build Pipeline
1. Create pipeline orchestration
2. Add SSE progress streaming
3. Implement QA retry loop

### Phase 4: Update Routes
1. Add `/api/jobs/:id/generate` endpoint
2. Deprecate callback endpoint
3. Update frontend to use new flow

### Phase 5: Remove n8n
1. Remove factory.ts webhook code
2. Remove callback.ts
3. Remove FACTORY_WEBHOOK_URL env var
4. Update documentation

---

## Benefits

| Aspect | n8n (Before) | In-House (After) |
|--------|--------------|------------------|
| Latency | ~30s (webhook + callback) | ~15s (direct) |
| Debugging | Complex (n8n logs separate) | Simple (unified logs) |
| Cost | n8n hosting + AI APIs | AI APIs only |
| Control | Limited customization | Full control |
| Reliability | External dependency | Self-contained |
| Scaling | n8n bottleneck | Horizontal scaling |

---

## Cost Estimation

Per tool generation (5 agents, ~3000 tokens each):
- Input tokens: ~15,000 (prompts + context)
- Output tokens: ~10,000 (specs + HTML)

**Claude Sonnet** (4 agents): ~$0.10 per tool
**Gemini Flash** (QA): ~$0.01 per tool

**Total: ~$0.11 per tool** (vs n8n hosting ~$30/month + same AI costs)

---

## Version

- Spec Version: 1.0
- Created: 2026-01-28
- Supersedes: n8n webhook architecture
