# V4 Workflow 3: Boss Revisions

> **Webhook URL**: `https://your-n8n.com/webhook/boss-revisions`
> **Method**: POST
> **Purpose**: Handle revision requests with BOSS PRIORITY (overrides all other principles)

---

## Critical Rule

> **BOSS WORD IS LAW**
>
> The boss's revision request has MORE WEIGHT than:
> - The 8-point criteria
> - Brand guidelines
> - Writing guide
> - QA recommendations
>
> If the boss says "add instructions", you add instructions.
> If the boss says "make it purple", you make it purple.
> **His word tops everything else.**

---

## Workflow Overview

```
Webhook (Boss Revision Request)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: INTAKE                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Validate     │ →  │ Fetch Tool   │ →  │ HTML to      │   │
│  │ Request      │    │ from MongoDB │    │ Markdown     │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: UNDERSTANDING (Revision Secretary)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: Revision Secretary                         │   │
│  │ - Reads the boss's exact revision request            │   │
│  │ - Identifies specific changes needed                 │   │
│  │ - Creates clear instructions for Revision Agent      │   │
│  │ - PRESERVES boss intent word-for-word                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: REVISION (Revision Agent)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Agent: Revision Agent                             │   │
│  │ Context:                                             │   │
│  │ - Original markdown (from HTML conversion)           │   │
│  │ - Revision Secretary instructions                    │   │
│  │ - Boss's exact words (quoted, preserved)             │   │
│  │ OUTPUT: Revised markdown                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: REBUILD                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Markdown     │ →  │ Apply to     │ →  │ Validate     │   │
│  │ to HTML      │    │ Template     │    │ HTML         │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 5: DELIVERY                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Update       │ →  │ Callback to  │ →  │ Respond to   │   │
│  │ MongoDB      │    │ Boss Office  │    │ Webhook      │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Boss sees revised tool with same 3 options:                │
│  • Approve and Deploy                                       │
│  • Request more revisions                                   │
│  • Reject                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Node-by-Node Configuration

### Node 1: Boss Revisions Webhook (Trigger)

```json
{
  "name": "Boss Revisions Webhook",
  "type": "n8n-nodes-base.webhook",
  "parameters": {
    "httpMethod": "POST",
    "path": "boss-revisions",
    "responseMode": "responseNode",
    "options": {}
  }
}
```

**Expected Payload**:
```json
{
  "job_id": "job_abc123",
  "boss_id": "boss_001",
  "action": "revise",
  "revision_request": "The scoring feels too harsh. Make it so that a score of 60% still gives a HIRE verdict. Also, add a section at the top that explains what this tool does - I know we usually don't do instructions but for this one I want them.",
  "priority_notes": "This is for the Enterprise clients, they need hand-holding",
  "current_html": "<html>...</html>",
  "callback_url": "https://backend.com/api/revisions/callback"
}
```

---

### Node 2: Validate Revision Request (Code)

```javascript
// Validate the revision request
const input = $input.first().json;

// Validate required fields
if (!input.job_id) throw new Error('Missing job_id');
if (!input.revision_request) throw new Error('Missing revision_request');
if (!input.current_html) throw new Error('Missing current_html');

// Log the revision request (for audit trail)
const revisionLog = {
  job_id: input.job_id,
  boss_id: input.boss_id,
  revision_request_raw: input.revision_request,
  priority_notes: input.priority_notes || null,
  received_at: new Date().toISOString()
};

return [{
  json: {
    ...input,
    revision_log: revisionLog,
    revision_count: (input.revision_count || 0) + 1
  }
}];
```

---

### Node 3: Fetch Original Tool Data (MongoDB)

```json
{
  "operation": "findOne",
  "collection": "generated_tools",
  "query": {
    "job_id": "={{ $json.job_id }}"
  }
}
```

---

### Node 4: HTML to Markdown (Code)

```javascript
// Convert HTML to Markdown for easier editing
const html = $json.current_html;

// Simple HTML to Markdown conversion
// In production, use a proper library like turndown

let markdown = html
  // Remove script tags
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  // Remove style tags (keep for reference)
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '[STYLES PRESERVED]')
  // Convert headings
  .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
  .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
  .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
  // Convert paragraphs
  .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
  // Convert lists
  .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  // Convert line breaks
  .replace(/<br\s*\/?>/gi, '\n')
  // Remove remaining tags
  .replace(/<[^>]+>/g, '')
  // Clean up whitespace
  .replace(/\n{3,}/g, '\n\n')
  .trim();

return [{
  json: {
    ...$input.first().json,
    original_markdown: markdown,
    original_html: html
  }
}];
```

---

### Node 5: Revision Secretary Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are "The Revision Secretary" - you translate boss requests into clear instructions.

CRITICAL RULE: THE BOSS'S WORD IS LAW

Whatever the boss asks for, we do it. Even if it contradicts:
- Our 8-point criteria
- Brand guidelines
- Previous QA feedback
- Best practices

Your job is NOT to judge the request. Your job is to:
1. Read the boss's exact words carefully
2. Identify every specific change requested
3. Create crystal-clear instructions for the Revision Agent
4. PRESERVE the boss's exact wording in quotes

OUTPUT FORMAT:
## Revision Secretary Brief

### Boss's Exact Request (Quoted)
> [Quote the boss's words exactly]

### Priority Notes (if any)
[Any context the boss provided]

### Changes Required

1. **Change #1**: [Specific change]
   - What to modify: [exact element/section]
   - How to modify: [specific instruction]
   - Boss's words: "[relevant quote]"

2. **Change #2**: [Specific change]
   - What to modify: [exact element/section]
   - How to modify: [specific instruction]
   - Boss's words: "[relevant quote]"

[Continue for all changes]

### Preservation Notes
[What should NOT be changed]

### Conflict Acknowledgment
[If any request conflicts with our guidelines, note it here but confirm we're doing it anyway because BOSS WORD IS LAW]

DO NOT:
- Question the boss's judgment
- Suggest alternatives
- Water down the requests
- Add your own interpretations

The Revision Agent needs to know EXACTLY what to do.
```

**User Message**:
```
## Boss's Revision Request
{{ $json.revision_request }}

## Priority Notes
{{ $json.priority_notes || 'None provided' }}

## Current Tool (Markdown)
{{ $json.original_markdown }}

Analyze the request and create the brief for the Revision Agent.
```

---

### Node 6: Revision Agent (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are "The Revision Agent" - you implement boss-requested changes.

CRITICAL RULE: THE BOSS'S WORD IS LAW

You will receive:
1. The original tool markdown
2. Clear instructions from the Revision Secretary
3. The boss's exact quoted requests

YOUR TASK:
Implement EVERY change requested. No shortcuts. No "improvements". No "I think this would be better".

RULES:
1. Make EXACTLY the changes requested - no more, no less
2. If boss says "add instructions" - add instructions
3. If boss says "change the threshold" - change the threshold
4. If boss says "make it purple" - make it purple
5. Preserve everything that wasn't mentioned for change
6. Output the complete revised markdown

OUTPUT:
Return the COMPLETE revised markdown. Include:
- All original content (unless boss said to remove it)
- All requested changes implemented
- Clear markers where changes were made: <!-- BOSS REVISION: [what changed] -->

DO NOT:
- Skip any requested changes
- Add changes the boss didn't ask for
- "Improve" things the boss didn't mention
- Argue with the instructions
```

**User Message**:
```
## Revision Secretary Brief
{{ $('Revision Secretary Agent').first().json.output }}

## Original Tool Markdown
{{ $json.original_markdown }}

Implement all the changes and output the revised markdown.
```

---

### Node 7: Markdown to HTML (AI Agent)

**Model**: Google Gemini 1.5 Pro

**System Message**:
```
You are the HTML Builder. Convert the revised markdown back into a complete HTML tool.

You have the original HTML as reference for:
- CSS styles (keep them)
- JavaScript functionality (keep it, update if needed)
- Overall structure (maintain it)

OUTPUT:
Return ONLY the complete HTML file. No explanations.

The HTML must:
- Be self-contained (CSS and JS inline)
- Be mobile responsive
- Preserve the Fast Track brand (unless boss changed it)
- Include all functionality
- Implement the markdown changes properly

Look for <!-- BOSS REVISION: --> comments in the markdown to identify what changed.
```

**User Message**:
```
## Revised Markdown
{{ $('Revision Agent').first().json.output }}

## Original HTML (for reference)
{{ $json.original_html }}

## Category
{{ $('Fetch Original Tool Data').first().json.category }}

Convert to complete HTML.
```

---

### Node 8: Validate HTML (Code)

```javascript
// Basic validation of the generated HTML
const html = $('Markdown to HTML').first().json.output;

const checks = {
  has_doctype: html.includes('<!DOCTYPE html>') || html.includes('<!doctype html>'),
  has_html_tag: html.includes('<html'),
  has_head: html.includes('<head'),
  has_body: html.includes('<body'),
  has_closing_tags: html.includes('</html>') && html.includes('</body>'),
  has_styles: html.includes('<style') || html.includes('style='),
  reasonable_length: html.length > 1000
};

const issues = Object.entries(checks)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (issues.length > 0) {
  // Log but don't fail - boss requested changes might have unusual HTML
  console.log('HTML validation warnings:', issues);
}

return [{
  json: {
    ...$input.first().json,
    revised_html: html,
    validation_warnings: issues,
    html_length: html.length
  }
}];
```

---

### Node 9: Update Tool in MongoDB

```json
{
  "operation": "updateOne",
  "collection": "generated_tools",
  "query": {
    "job_id": "={{ $json.job_id }}"
  },
  "update": {
    "$set": {
      "html_content": "={{ $json.revised_html }}",
      "status": "pending_approval",
      "last_revised_at": "={{ new Date().toISOString() }}",
      "revision_count": "={{ $json.revision_count }}"
    },
    "$push": {
      "revision_history": {
        "revision_number": "={{ $json.revision_count }}",
        "boss_request": "={{ $json.revision_request }}",
        "priority_notes": "={{ $json.priority_notes }}",
        "revised_at": "={{ new Date().toISOString() }}"
      }
    }
  }
}
```

---

### Node 10: Callback to Boss Office (HTTP Request)

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
    "status": "revision_complete",
    "revision_count": "={{ $json.revision_count }}",
    "preview_html": "={{ $json.revised_html }}",
    "validation_warnings": "={{ $json.validation_warnings }}",
    "message": "Revision complete. Ready for your review."
  }
}
```

---

### Node 11: Respond to Webhook

```json
{
  "respondWith": "json",
  "responseBody": {
    "success": true,
    "job_id": "={{ $json.job_id }}",
    "revision_count": "={{ $json.revision_count }}",
    "message": "Revision processed and sent for boss review"
  },
  "options": {
    "responseCode": 200
  }
}
```

---

## Revision Loop

The boss can request multiple revisions. Each time:

1. Boss reviews the tool in Boss Office
2. If not satisfied, submits another revision request
3. Workflow runs again with the new `current_html` (the previously revised version)
4. `revision_count` increments
5. Full `revision_history` is maintained in MongoDB

```
Boss Office                    n8n Boss Revisions
    │                                 │
    │ Revision Request #1             │
    ├────────────────────────────────►│
    │                                 │ Process...
    │◄────────────────────────────────┤ Revised HTML #1
    │                                 │
    │ "Still not right..."            │
    │ Revision Request #2             │
    ├────────────────────────────────►│
    │                                 │ Process...
    │◄────────────────────────────────┤ Revised HTML #2
    │                                 │
    │ "Perfect! Deploy it."           │
    │ Action: approve                 │
    ├────────────────────────────────►│ Deploy Tools Workflow
    │                                 │
```

---

## Example Revision Scenarios

### Scenario 1: Change Scoring Threshold

**Boss Request**: "The threshold is too high. Change it so 50% is a HIRE instead of 70%."

**Secretary Brief**:
```markdown
### Boss's Exact Request (Quoted)
> "The threshold is too high. Change it so 50% is a HIRE instead of 70%."

### Changes Required
1. **Change #1**: Lower HIRE threshold
   - What to modify: Verdict calculation logic
   - How to modify: Change threshold from 70% to 50%
   - Boss's words: "50% is a HIRE instead of 70%"

### Conflict Acknowledgment
This conflicts with our standard 70% threshold guideline, but BOSS WORD IS LAW.
```

---

### Scenario 2: Add Instructions (Against Our Rules)

**Boss Request**: "Add a section at the top explaining how to use the tool. I know we don't normally do this but these clients need it."

**Secretary Brief**:
```markdown
### Boss's Exact Request (Quoted)
> "Add a section at the top explaining how to use the tool. I know we don't normally do this but these clients need it."

### Priority Notes
Client-specific requirement - they need hand-holding

### Changes Required
1. **Change #1**: Add instructions section
   - What to modify: Top of the tool (after header, before first question)
   - How to modify: Add a clear "How to Use This Tool" section
   - Boss's words: "explaining how to use the tool"

### Conflict Acknowledgment
This directly conflicts with our "ZERO INSTRUCTIONS" rule in the 8-point criteria.
However, the boss explicitly acknowledged this ("I know we don't normally do this")
and has a specific reason (client needs). BOSS WORD IS LAW - we add the instructions.
```

---

### Scenario 3: Brand Color Change

**Boss Request**: "Make the primary color blue instead of orange. This is for the finance course and orange feels too casual."

**Secretary Brief**:
```markdown
### Boss's Exact Request (Quoted)
> "Make the primary color blue instead of orange. This is for the finance course and orange feels too casual."

### Changes Required
1. **Change #1**: Change primary color
   - What to modify: All CSS using #FF6B35 (Fast Track orange)
   - How to modify: Replace with a professional blue (suggest #2563EB or similar)
   - Boss's words: "blue instead of orange"

### Conflict Acknowledgment
This changes our brand color. Boss has specific reasoning (finance course context).
BOSS WORD IS LAW - we make it blue.
```

---

## Testing

Test payload:
```json
{
  "job_id": "test_revision_001",
  "boss_id": "boss_test",
  "action": "revise",
  "revision_request": "Change the HIRE threshold from 70% to 60%. Also make the verdict text bigger and add a confetti animation when someone gets HIRE.",
  "priority_notes": "Client demo next week, needs to feel more celebratory",
  "current_html": "<!DOCTYPE html><html>... current tool HTML ...</html>",
  "callback_url": "https://webhook.site/your-test-url"
}
```
