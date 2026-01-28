# V4 Workflow 1: Tool Factory

> **Webhook URL**: `https://your-n8n.com/webhook/tool-factory`
> **Method**: POST
> **Agents**: 5 (Secretary, Builder, Template Decider, QA, Feedback Applier)

---

## Workflow Overview

```
Webhook (Boss Submission)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: INTAKE                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Parse Input  │ →  │ Extract File │ →  │ Category     │   │
│  │ (Code)       │    │ Content      │    │ Router       │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: UNDERSTANDING (Secretary Agent)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: The Secretary                              │   │
│  │ - Reads course content (PDF/DOCX/MD/TXT)             │   │
│  │ - Analyzes boss specification answers                │   │
│  │ - Creates structured brief for Builder               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: BUILDING (Tool Builder Agent)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: Tool Builder                               │   │
│  │ System Context:                                      │   │
│  │ - Fast Track approach to educational tools           │   │
│  │ - Previous mistakes & feedback                       │   │
│  │ - 8-Point Criteria for world-class tools             │   │
│  │ OUTPUT: Markdown specification                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: TEMPLATE SELECTION (Template Decider Agent)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: Template Decider                           │   │
│  │ - Reviews markdown spec                              │   │
│  │ - Analyzes required functionality                    │   │
│  │ - Selects appropriate template                       │   │
│  │ OUTPUT: Template ID + populated HTML                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 5: QUALITY ASSURANCE (QA Department Agent)           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: QA Department (DIFFERENT MODEL - NO BIAS)  │   │
│  │ - Validates against QA criteria                      │   │
│  │ - Checks for inconsistencies                         │   │
│  │ - Verifies boss requirements met                     │   │
│  │ OUTPUT: PASS or FAIL + feedback                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ├── PASS ──────────────────────────────────────────────────┐
    │                                                          │
    ▼ FAIL                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 6: REVISION LOOP (Feedback Applier Agent)            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: Feedback Applier                           │   │
│  │ Context received:                                    │   │
│  │ - Original Secretary brief                           │   │
│  │ - Builder's markdown spec                            │   │
│  │ - Template used                                      │   │
│  │ - QA feedback & recommendations                      │   │
│  │ OUTPUT: Revised HTML → back to QA                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (Loop back to QA, max 3 attempts)
    │
    ▼ PASS
┌─────────────────────────────────────────────────────────────┐
│  STAGE 7: DELIVERY                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Store in     │ →  │ Callback to  │ →  │ Respond to   │   │
│  │ MongoDB      │    │ Boss Office  │    │ Webhook      │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## IMPORTANT: Context Embedding Strategy

**Per CTO guidance**: The Three Principles (8-Point Criteria, Brand Guidelines, Friction Report) are **embedded directly in agent system prompts** rather than fetched from MongoDB at runtime.

**Why this approach**:
- Reduces token overhead by ~60%
- Eliminates MongoDB fetch latency
- Ensures consistent context every time
- Makes agents faster and more reliable

**See**: `V4-COMPRESSED-PROMPTS.md` for the complete embedded context.

---

## Node-by-Node Configuration

### Node 1: Webhook (Trigger)

```json
{
  "name": "Tool Factory Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "tool-factory",
    "responseMode": "responseNode",
    "options": {
      "rawBody": true
    }
  }
}
```

**Expected Payload**:
```json
{
  "job_id": "job_abc123",
  "boss_id": "boss_001",
  "category": "b2b_service",
  "specification_answers": {
    "tool_name": "Agency Hiring Decision Tool",
    "target_decision": "Should I hire this marketing agency?",
    "key_factors": ["budget", "expertise", "cultural fit"],
    "desired_outcome": "Clear HIRE or DON'T HIRE verdict"
  },
  "course_content": {
    "filename": "sprint-5-agency-selection.pdf",
    "content_base64": "JVBERi0xLjQKJ...",
    "content_type": "application/pdf"
  },
  "callback_url": "https://backend.com/api/factory/callback"
}
```

---

### Node 2: Parse & Normalize Input (Code)

```javascript
// Parse & Normalize Input
const input = $input.first().json;

// Validate required fields
const required = ['job_id', 'category', 'specification_answers', 'course_content'];
for (const field of required) {
  if (!input[field]) {
    throw new Error(`Missing required field: ${field}`);
  }
}

// Normalize category
const validCategories = ['b2b_product', 'b2b_service', 'b2c_product', 'b2c_service'];
const category = input.category?.toLowerCase().replace('-', '_');
if (!validCategories.includes(category)) {
  throw new Error(`Invalid category: ${input.category}. Must be one of: ${validCategories.join(', ')}`);
}

// Generate slug from tool name
const toolSlug = input.specification_answers.tool_name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

return [{
  json: {
    job_id: input.job_id,
    boss_id: input.boss_id,
    category: category,
    tool_slug: toolSlug,
    tool_name: input.specification_answers.tool_name,
    specification: input.specification_answers,
    course_content: input.course_content,
    callback_url: input.callback_url,
    created_at: new Date().toISOString(),
    attempt: 1,
    max_attempts: 3
  }
}];
```

---

### Node 3: Extract File Content (Code)

```javascript
// Extract content from PDF/DOCX/MD/TXT
const input = $input.first().json;
const file = input.course_content;

let extractedText = '';

// Decode base64 content
const buffer = Buffer.from(file.content_base64, 'base64');

// Handle different file types
switch (file.content_type) {
  case 'application/pdf':
    // Note: In n8n, use the PDF Parse node before this
    // This code assumes text has been extracted
    extractedText = $('PDF Parse').first().json.text || '';
    break;

  case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    // DOCX - use Extract From File node
    extractedText = $('Extract From File').first().json.text || '';
    break;

  case 'text/markdown':
  case 'text/plain':
    extractedText = buffer.toString('utf-8');
    break;

  default:
    extractedText = buffer.toString('utf-8');
}

return [{
  json: {
    ...input,
    course_content_text: extractedText,
    content_length: extractedText.length
  }
}];
```

---

### Node 4: Category Router (Code)

```javascript
// Category Router - Adds category-specific context
const input = $input.first().json;

const CATEGORIES = {
  b2b_product: {
    name: 'B2B Product',
    decision_type: 'GO / NO-GO',
    prompt_additions: `
## B2B PRODUCT CONTEXT
The user is evaluating a PRODUCT purchase for their business.

Key considerations:
- Total Cost of Ownership (TCO)
- Integration with existing systems
- Vendor stability and support
- Implementation timeline
- Scalability for growth

Your tool MUST:
1. Calculate or estimate ROI
2. Include integration/compatibility assessment
3. Force a GO/NO-GO decision with specific recommendation
4. Include implementation timeline
`,
    template_hint: 'calculation',
    scoring_weights: { decision: 25, roi: 30, time: 15, risk: 20, commitment: 10 }
  },

  b2b_service: {
    name: 'B2B Service',
    decision_type: 'HIRE / DON\'T HIRE',
    prompt_additions: `
## B2B SERVICE CONTEXT
The user is evaluating a SERVICE provider (agency, consultant, partner).

Key considerations:
- Provider expertise and track record
- Cultural and communication fit
- Pricing model alignment
- Knowledge transfer and IP
- Exit strategy and switching costs

Your tool MUST:
1. Assess cultural/communication fit
2. Evaluate pricing model suitability
3. Include red flags checklist
4. Force a HIRE/DON'T HIRE decision
5. Include contract negotiation priorities if HIRE
`,
    template_hint: 'assessment',
    scoring_weights: { decision: 20, roi: 20, time: 15, risk: 25, commitment: 20 }
  },

  b2c_product: {
    name: 'B2C Product',
    decision_type: 'BUY NOW / WAIT / SKIP',
    prompt_additions: `
## B2C PRODUCT CONTEXT
The user is making a PERSONAL product purchase.

Key considerations:
- Budget and financing options
- Personal needs vs wants
- Lifestyle fit and daily use
- Long-term value vs immediate gratification
- Timing - is now the right time?

Your tool MUST:
1. Separate needs from wants explicitly
2. Include budget reality check
3. Address the "should I wait?" question
4. Force a BUY NOW / WAIT / SKIP decision
5. If BUY NOW - specify exactly which option
`,
    template_hint: 'decision',
    scoring_weights: { decision: 30, roi: 15, time: 20, risk: 15, commitment: 20 }
  },

  b2c_service: {
    name: 'B2C Service',
    decision_type: 'COMMIT / NOT READY / WRONG FIT',
    prompt_additions: `
## B2C SERVICE CONTEXT
The user is evaluating a PERSONAL service (coaching, fitness, education).

Key considerations:
- Personal chemistry and trust
- Track record with similar clients
- Value alignment with provider
- Commitment level required
- Results timeline expectations

Your tool MUST:
1. Assess personal readiness for the service
2. Evaluate provider fit beyond credentials
3. Set realistic outcome expectations
4. Force a COMMIT / NOT READY / WRONG FIT decision
5. If COMMIT - include accountability mechanism
`,
    template_hint: 'readiness',
    scoring_weights: { decision: 25, roi: 15, time: 15, risk: 20, commitment: 25 }
  }
};

const config = CATEGORIES[input.category] || CATEGORIES.b2b_service;

return [{
  json: {
    ...input,
    category_config: config
  }
}];
```

---

### ~~Node 5: Fetch Context Documents~~ (REMOVED)

> **REMOVED**: Per CTO guidance, context documents (8-Point Criteria, Brand Guidelines, Friction Report) are now **embedded directly in agent system prompts** instead of fetched from MongoDB.
>
> This reduces latency and ensures consistent context. See `V4-COMPRESSED-PROMPTS.md` for the embedded versions.

---

### ~~Node 6: Merge Context~~ (REMOVED)

> **REMOVED**: No longer needed since context is embedded in system prompts.

---

### Node 5: Secretary Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are "The Secretary" - the first point of contact in the Fast Track Tool Factory.

YOUR ROLE:
1. Read and deeply understand the course content provided
2. Analyze the boss's specification answers
3. Create a clear, structured brief for the Tool Builder

OUTPUT FORMAT (Markdown):
## Secretary Brief

### Course Content Summary
[2-3 paragraph summary of what the course teaches]

### Key Learning Objectives
- [List the main things students should learn]

### Tool Requirements (from Boss)
- Tool Name: [name]
- Target Decision: [what decision the tool helps make]
- Key Factors: [list]
- Desired Outcome: [outcome]

### Category Context
[Explain why this is a {category} tool and what that means]

### Recommended Tool Focus
[Your recommendation on what the tool should prioritize]

### Success Criteria
[What would make this tool successful for the course]

BE DIRECT. NO FLUFF. The Tool Builder needs actionable intelligence.
```

**User Message**:
```
## Course Content
{{ $json.course_content_text }}

## Boss Specification Answers
{{ JSON.stringify($json.specification, null, 2) }}

## Category
{{ $json.category_config.name }}

Analyze this and create the brief for the Tool Builder.
```

---

### Node 6: Tool Builder Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message** (EMBEDDED - from V4-COMPRESSED-PROMPTS.md):
```
You are the Fast Track Tool Builder. You create world-class educational tools.

## THE 8-POINT CRITERIA (MANDATORY - ALL MUST PASS)
Every tool MUST satisfy ALL 8 points:
1. FORCES DECISION - Concrete outcome, not just thinking. User leaves with GO/NO-GO verdict.
2. ZERO INSTRUCTIONS - Self-evident. No "how to use" text. No confusion. No support needed.
3. EASY FIRST STEPS - Simple entry that builds confidence immediately.
4. INSTANT FEEDBACK - Every input shows immediate validation (like credit card fields turning red).
5. GAMIFICATION - Progress bars, scores, visual rewards that make progress feel exciting.
6. VISIBLE RESULTS - Crystal clear output showing exactly what user created.
7. COMMITMENT CAPTURE - Public commitment mechanism that creates accountability.
8. FAST TRACK DNA - Unmistakable brand identity. Gritty. Direct. Premium €20K feel.

## BRAND DNA
CORE PRINCIPLES:
- Brutal Honesty: No sugar-coating. Truth over comfort. Direct and clear.
- Obsessive 80/20: 20% of inputs drive 80% of outcomes. Ruthless prioritization.
- Die Empty: Full commitment or nothing. Total effort until job is done.

TONE OF VOICE:
DO: Short sharp sentences. Active tense. Day-to-day language. Bold statements.
DON'T: Rambling. Hedge words (maybe, might, could). Corporate jargon. Fluff.

## WHAT A TOOL IS
A tool helps users APPLY knowledge to MAKE DECISIONS.
- NOT a quiz, NOT passive reading, NOT a worksheet to print
- IS an active decision machine with gamification and commitment

## FRICTION POINTS TO AVOID
❌ Vague terms without definitions
❌ Blank text boxes with no ghost text guidance
❌ No validation on inputs
❌ Too many steps visible at once (use wizard flow)
❌ No progress indicator
❌ Dense walls of text
❌ Ending with "things to consider" instead of verdict
❌ No commitment capture at the end

## OUTPUT FORMAT
Create a complete MARKDOWN SPECIFICATION including:
1. Tool metadata (name, slug, category, tagline)
2. All questions/inputs with ghost text examples
3. Scoring logic for each input (weights, thresholds)
4. Verdict calculation rules (when GO vs NO-GO)
5. UI sections and wizard flow (step 1, step 2, etc.)
6. Commitment capture mechanism
7. Export/share functionality

The spec must be detailed enough to build the HTML directly.
```

**User Message**:
```
## Secretary Brief
{{ $('Secretary Agent').first().json.output }}

Create the complete tool specification in Markdown.
```

---

### Node 9: Template Decider Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are "The Template Decider" - you select the right template and build the final HTML.

AVAILABLE TEMPLATES:
1. b2b-product - For business product decisions (calculations, ROI, TCO)
2. b2b-service - For hiring decisions (assessments, red flags, fit checks)
3. b2c-product - For personal purchases (needs vs wants, budget, timing)
4. b2c-service - For personal services (readiness, commitment, goals)

YOUR TASK:
1. Review the Tool Builder's markdown specification
2. Select the most appropriate template based on:
   - Category (already specified)
   - Required functionality (calculations? assessment? brainstorming?)
   - Decision type needed
3. Output the complete HTML tool

TEMPLATE FEATURES:
- b2b-product: ROI calculator, TCO breakdown, integration checklist
- b2b-service: Fit assessment, red flags detector, negotiation priorities
- b2c-product: Needs/wants separator, budget checker, timing advisor
- b2c-service: Readiness meter, commitment tracker, goal alignment

OUTPUT:
Return ONLY the complete HTML file. No explanations. No markdown. Just HTML.
The HTML must be:
- Self-contained (all CSS and JS inline)
- Mobile responsive
- Follow Fast Track brand colors (#FF6B35 orange, #1A1A2E dark)
- Include all functionality from the specification
```

**User Message**:
```
## Category
{{ $json.category }}

## Template Hint
{{ $json.category_config.template_hint }}

## Tool Specification (from Builder)
{{ $('Tool Builder Agent').first().json.output }}

Select the template and generate the complete HTML.
```

---

### Node 10: QA Department Agent (AI Agent)

**Model**: OpenAI GPT-4 (DIFFERENT MODEL = NO BIAS)

**System Message**:
```
You are "The QA Department" - the quality guardian of Fast Track tools.

YOU USE A DIFFERENT AI MODEL TO ENSURE NO BIAS.

YOUR VALIDATION CRITERIA:
1. Does the tool FORCE a clear decision? (Not optional, not "maybe")
2. Are there ZERO instructions? (Tool must be self-evident)
3. Is there INSTANT FEEDBACK on every input?
4. Is there visible GAMIFICATION? (Progress, scores, visuals)
5. Is the VERDICT crystal clear and unambiguous?
6. Is there a COMMITMENT mechanism at the end?
7. Does it have FAST TRACK DNA? (Bold, direct, no hedge words)
8. Is it a SINGLE, SELF-CONTAINED HTML file?

ADDITIONAL CHECKS:
- Does the tool match what the boss requested?
- Are there any calculation errors?
- Is the mobile responsive CSS working?
- Are there any broken JavaScript functions?
- Does the category-specific decision language match?

OUTPUT FORMAT:
{
  "result": "PASS" or "FAIL",
  "score": 0-100,
  "criteria_scores": {
    "force_decision": 0-100,
    "zero_instructions": 0-100,
    "instant_feedback": 0-100,
    "gamification": 0-100,
    "clear_verdict": 0-100,
    "commitment": 0-100,
    "fast_track_dna": 0-100,
    "single_html": 0-100
  },
  "issues": ["list of issues found"],
  "recommendations": ["list of specific fixes needed"],
  "boss_requirements_met": true/false,
  "boss_requirements_issues": ["any mismatches with boss request"]
}

PASS threshold: score >= 85 AND no critical issues
```

**User Message**:
```
## Original Boss Request
Tool Name: {{ $json.tool_name }}
Target Decision: {{ $json.specification.target_decision }}
Key Factors: {{ $json.specification.key_factors }}
Desired Outcome: {{ $json.specification.desired_outcome }}

## Category
{{ $json.category_config.name }} ({{ $json.category_config.decision_type }})

## Generated HTML
{{ $('Template Decider Agent').first().json.output }}

Validate this tool against all criteria.
```

---

### Node 11: QA Result Router (If)

```json
{
  "conditions": {
    "boolean": [
      {
        "value1": "={{ $json.result }}",
        "value2": "PASS"
      }
    ]
  }
}
```

- **True (PASS)** → Go to Node 13 (Store & Deliver)
- **False (FAIL)** → Go to Node 12 (Feedback Applier)

---

### Node 12: Feedback Applier Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are "The Feedback Applier" - you fix issues identified by QA.

YOU HAVE FULL CONTEXT:
1. Original Secretary brief (what the boss wanted)
2. Tool Builder's specification (what was planned)
3. Template used (the chosen template)
4. QA feedback (exactly what's wrong and how to fix it)

YOUR TASK:
Apply ALL QA feedback and recommendations. No shortcuts.

RULES:
1. Keep the same template structure
2. Fix every issue mentioned by QA
3. Ensure all 8-point criteria are satisfied
4. Maintain Fast Track brand and tone
5. Output the COMPLETE fixed HTML

DO NOT explain what you fixed. Just output the corrected HTML.
```

**User Message**:
```
## Original Secretary Brief
{{ $('Secretary Agent').first().json.output }}

## Original Builder Specification
{{ $('Tool Builder Agent').first().json.output }}

## Current HTML (with issues)
{{ $('Template Decider Agent').first().json.output }}

## QA Feedback
{{ JSON.stringify($('QA Department Agent').first().json, null, 2) }}

Fix all issues and output the corrected HTML.
```

**After Feedback Applier** → Loop back to QA Department (Node 10)
- Add attempt counter check: if attempt >= max_attempts, force PASS with warning

---

### Node 13: Store Tool in MongoDB

```json
{
  "operation": "insertOne",
  "collection": "generated_tools",
  "document": {
    "job_id": "={{ $json.job_id }}",
    "tool_slug": "={{ $json.tool_slug }}",
    "tool_name": "={{ $json.tool_name }}",
    "category": "={{ $json.category }}",
    "html_content": "={{ $('QA Result Router').first().json.html || $('Template Decider Agent').first().json.output }}",
    "qa_score": "={{ $('QA Department Agent').first().json.score }}",
    "qa_result": "={{ $('QA Department Agent').first().json }}",
    "revision_count": "={{ $json.attempt }}",
    "status": "pending_approval",
    "created_at": "={{ new Date().toISOString() }}"
  }
}
```

---

### Node 14: Callback to Boss Office (HTTP Request)

```json
{
  "method": "POST",
  "url": "={{ $json.callback_url }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": {
    "job_id": "={{ $json.job_id }}",
    "status": "ready_for_review",
    "tool_name": "={{ $json.tool_name }}",
    "tool_slug": "={{ $json.tool_slug }}",
    "qa_score": "={{ $('QA Department Agent').first().json.score }}",
    "preview_html": "={{ $('QA Result Router').first().json.html || $('Template Decider Agent').first().json.output }}"
  }
}
```

---

### Node 15: Respond to Webhook

```json
{
  "respondWith": "json",
  "responseBody": {
    "success": true,
    "job_id": "={{ $json.job_id }}",
    "message": "Tool generated and sent for boss review",
    "qa_score": "={{ $('QA Department Agent').first().json.score }}"
  },
  "options": {
    "responseCode": 200
  }
}
```

---

## Error Handling

Add error handling nodes:

1. **Try/Catch around each agent** - Capture AI failures
2. **Timeout handling** - 5 minute max per agent
3. **Fallback responses** - Return meaningful errors to Boss Office

```javascript
// Error Handler (Code node)
const error = $input.first().json.error;

// Log to MongoDB
await $('MongoDB').insertOne({
  collection: 'factory_errors',
  document: {
    job_id: $json.job_id,
    error_message: error.message,
    error_stack: error.stack,
    stage: error.stage,
    timestamp: new Date().toISOString()
  }
});

// Callback with error
return [{
  json: {
    job_id: $json.job_id,
    status: 'error',
    error: error.message
  }
}];
```

---

## Testing

Test payload for the webhook:

```json
{
  "job_id": "test_001",
  "boss_id": "boss_test",
  "category": "b2b_service",
  "specification_answers": {
    "tool_name": "Marketing Agency Fit Checker",
    "target_decision": "Should I hire this marketing agency?",
    "key_factors": ["budget alignment", "industry expertise", "communication style", "past results"],
    "desired_outcome": "Clear HIRE or DON'T HIRE with negotiation priorities"
  },
  "course_content": {
    "filename": "test-content.txt",
    "content_base64": "VGhpcyBjb3Vyc2UgdGVhY2hlcyBob3cgdG8gZXZhbHVhdGUgYW5kIHNlbGVjdCBtYXJrZXRpbmcgYWdlbmNpZXMuLi4=",
    "content_type": "text/plain"
  },
  "callback_url": "https://your-backend.com/api/factory/callback"
}
```
