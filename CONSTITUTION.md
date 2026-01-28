# Fast Track Tool Factory V4 Constitution

> *"Knowledge application — a good tool helps you further polish the knowledge you have obtained and to apply it exactly where needed."*

---

## Core Principles

### I. Single HTML File Output (NON-NEGOTIABLE)

Every tool produced by this system MUST be a **single, self-contained HTML file**.

- All CSS embedded in `<style>` tags
- All JavaScript embedded in `<script>` tags
- All fonts loaded via CDN or base64 encoded
- Zero external dependencies
- Works offline after initial load
- No build step required to run

**Why**: Simplicity in deployment. One file = one tool. Copy anywhere, paste anywhere, works everywhere.

---

### II. Decision is the Product

Tools do not teach. Tools do not inform. Tools **force decisions**.

Every tool MUST end with one of these outcomes:
- **GO / NO-GO**
- **YES / NO**
- **PROCEED / STOP**
- **A specific commitment with a deadline**

**Why**: Elite CEOs don't need more content. They need clarity to act. The decision IS the value.

---

### III. Category Specificity

Every tool belongs to exactly ONE category. No hybrids. No "general purpose."

| Category | Description | Target User |
|----------|-------------|-------------|
| **B2B Product** | Business purchasing a product/software | Company evaluating tools |
| **B2B Service** | Business hiring a service provider | Company selecting agency/consultant |
| **B2C Product** | Individual purchasing a product | Person making purchase decision |
| **B2C Service** | Individual hiring a service | Person selecting coach/trainer/service |

**Why**: Specificity creates relevance. A tool that tries to serve everyone serves no one.

---

### IV. Boss Authority Supremacy

The Boss (admin) has **absolute authority** over all system decisions.

**Hierarchy of Authority:**
```
1. Boss Revision Request     ← SUPREME (overrides everything)
2. Boss Original Spec        ← Defines the mission
3. QA Department Feedback    ← Quality enforcement
4. AI Agent Decisions        ← Execution layer
5. System Defaults           ← Fallback only
```

When Boss requests a revision:
- QA validation is **bypassed**
- AI does not "improve" or "suggest alternatives"
- Changes are applied **exactly as requested**
- Tool returns to Boss for final approval

**Why**: The Boss knows the business context. AI does not. Human judgment is supreme.

---

### V. The Factory Pipeline

All tools flow through a **fixed, sequential pipeline**. No shortcuts. No bypasses.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOSS OFFICE                               │
│  [Upload Content] → [Answer 5 Questions] → [Submit]             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     n8n: TOOL FACTORY                           │
│                                                                 │
│  ┌──────────────┐    Reads content + questionnaire answers      │
│  │  SECRETARY   │──→ Creates structured brief for Builder       │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    Has 3 context sources in system prompt:    │
│  │ TOOL BUILDER │    • Company approach to educational tools    │
│  │              │    • Previous mistakes & feedback             │
│  └──────┬───────┘    • 8-Point Quality Criteria                 │
│         │            Outputs: Complete tool in Markdown         │
│         ▼                                                       │
│  ┌──────────────┐    Reviews markdown, analyzes functionality   │
│  │   TEMPLATE   │    needed (calculation? brainstorm? etc.)     │
│  │   DECIDER    │    Selects most suitable HTML template        │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    Different AI model (no bias)               │
│  │      QA      │    Validates against separate criteria        │
│  │  DEPARTMENT  │    Spots inconsistencies & missing elements   │
│  └──────┬───────┘                                               │
│         │                                                       │
│    PASS │ FAIL                                                  │
│         │    │                                                  │
│         │    ▼                                                  │
│         │ ┌──────────────┐  Gets: Secretary brief               │
│         │ │   FEEDBACK   │  Gets: Builder markdown              │
│         │ │   APPLYER    │  Gets: Template used                 │
│         │ └──────┬───────┘  Gets: QA feedback                   │
│         │        │          Implements ALL feedback             │
│         │        └────────→ Returns to QA for re-validation     │
│         │                                                       │
│         ▼                                                       │
└─────────┬───────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BOSS OFFICE                               │
│                      [Preview Tool]                              │
│                                                                 │
│         ┌────────────┬────────────┬────────────┐                │
│         │            │            │            │                │
│         ▼            ▼            ▼            │                │
│     APPROVE      REVISE       REJECT          │                │
│         │            │            │            │                │
└─────────┼────────────┼────────────┼────────────┘                │
          │            │            │                              │
          ▼            │            ▼                              │
┌─────────────────┐    │     [Archive Job]                        │
│ n8n: DEPLOY     │    │                                          │
│                 │    │                                          │
│ • Push to GitHub│    │                                          │
│ • Create MongoDB│    │                                          │
│   Collection    │    │                                          │
│ • Deploy to     │    │                                          │
│   GitHub Pages  │    │                                          │
└────────┬────────┘    │                                          │
         │             │                                          │
         ▼             ▼                                          │
┌─────────────────┐  ┌─────────────────────────────────────────┐  │
│  SUCCESS POPUP  │  │         n8n: BOSS REVISIONS             │  │
│                 │  │                                         │  │
│ • Tool URL      │  │ HTML → Markdown → Secretary → Revision  │  │
│ • Copy Button   │  │ Agent → Markdown → HTML → Back to Boss  │  │
│ • "Paste in     │  │                                         │  │
│   LearnWorlds"  │  │ Boss word TOPS everything else          │  │
└─────────────────┘  └─────────────────────────────────────────┘  │
                              │                                    │
                              └──────────────→ [Preview Tool] ─────┘
```

**Why**: Predictable flow = debuggable system. Every tool takes the same path.

---

### VI. The 8-Point Quality Criteria

Every tool MUST satisfy ALL 8 criteria before deployment. This is the QA Department's checklist.

| # | Criterion | Requirement |
|---|-----------|-------------|
| 1 | **Forces Concrete Decision** | Tool ends with YES/NO, GO/NO-GO, or specific commitment |
| 2 | **Zero Instructions Needed** | Labels self-explanatory, visual cues guide user flow |
| 3 | **Easy First Steps** | Step 1 has simplest inputs to build confidence |
| 4 | **Instant Feedback** | Every input receives immediate LOW/MID/HIGH feedback |
| 5 | **Gamification** | Progress feels rewarding (bars, achievements, momentum) |
| 6 | **Crystal Clear Verdict** | Result = Verdict + Specific Next Action (no vague advice) |
| 7 | **Public Commitment** | Sharing mechanism for accountability built-in |
| 8 | **Fast Track DNA** | Brutal honesty, action verbs, no corporate speak |

**Why**: Consistency creates trust. Users know what to expect from every Fast Track tool.

---

### VII. Forbidden Language

The following words are **BANNED** from all tools. Their presence is an automatic QA failure.

**Hedge Words (destroy decisiveness):**
```
might, could, perhaps, maybe, possibly, potentially, somewhat,
fairly, rather, quite, arguably, presumably
```

**Corporate Speak (destroys authenticity):**
```
leverage, synergy, optimization, stakeholder, bandwidth, paradigm,
deliverable, actionable, scalable, ecosystem, holistic, streamline,
best-in-class, cutting-edge, game-changer, move the needle,
circle back, take offline, low-hanging fruit, deep dive
```

**Why**: Elite CEOs smell corporate bullshit instantly. Clarity and directness build trust.

---

### VIII. One Tool = One Collection

Every deployed tool gets its **OWN MongoDB collection**, but all collections live in the same database.

```
Database: fast_track_tools_v4
│
├── Collection: jobs              (all job records)
├── Collection: tools             (deployed tools registry)
├── Collection: system_context    (AI context documents)
├── Collection: audit_log         (all system events)
│
├── Collection: tool_marketing_roi_calculator     (tool responses)
├── Collection: tool_hiring_decision_canvas       (tool responses)
├── Collection: tool_pricing_strategy_validator   (tool responses)
└── Collection: tool_{slug}                       (tool responses)
```

Each tool collection stores:
- Tool metadata (questions, scoring config)
- User responses (inputs, scores, verdicts)
- Commitments (text, deadline, accountability partner)
- Analytics (aggregated stats)

**Why**: Isolation enables independent scaling. One tool's traffic doesn't affect another.

---

### IX. URL Delivery Ceremony

When a tool deploys successfully, the Boss MUST receive the URL in a **prominent, unmissable way**.

**Success Modal Requirements:**
1. Full-screen modal (cannot be ignored)
2. Tool URL displayed prominently (large, readable font)
3. One-click "Copy URL" button
4. "Open Tool in New Tab" button
5. Clear instruction: "Paste this URL in LearnWorlds course button"
6. "Done" button to close modal
7. URL saved to job record for future reference

**Why**: The entire system exists to produce this URL. Its delivery must be ceremonial.

---

## The Five Specification Questions

When Boss uploads content, they answer these 5 questions. These questions are **sacred** — they define the tool.

| # | Question | Purpose |
|---|----------|---------|
| 1 | **Category**: B2B Product / B2B Service / B2C Product / B2C Service? | Determines template family |
| 2 | **Decision**: What specific decision should users make with this tool? | Defines the tool's purpose |
| 3 | **Teaching Point**: What knowledge from the sprint should this tool help apply? | Grounds tool in course content |
| 4 | **Inputs**: What information should users provide? | Defines the tool's data collection |
| 5 | **Verdict Criteria**: How should the tool calculate GO/NO-GO? | Defines scoring logic |

**Why**: Garbage in = garbage out. Precise questions yield precise tools.

---

## AI Agent Context Sources

### Tool Builder Agent receives 3 context documents:

**1. Company Approach** (`context/approach.md`)
How Fast Track thinks about educational tools. Philosophy, principles, methodology.

**2. Previous Mistakes & Feedback** (`context/feedback.md`)
Lessons learned from existing tools. What went wrong. What users complained about. What worked.

**3. 8-Point Quality Criteria** (`context/criteria.md`)
The detailed criteria for world-class educational tools. Examples of passing vs. failing tools.

### QA Department Agent uses:
- **Different criteria document** (to catch Builder blind spots)
- **Different AI model** (to eliminate bias)
- **Boss's original requirements** (to validate alignment)

**Why**: Multiple perspectives catch more errors. Diversity of validation = quality.

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Admin Panel** | Vite + TypeScript | Fast, modern, type-safe |
| **Backend API** | Express.js | Simple, proven, flexible |
| **Database** | MongoDB | Document-friendly, scalable |
| **Workflow Engine** | n8n | Visual, AI-native, webhook-friendly |
| **AI Models** | Gemini + GPT-4o | Multiple vendors for QA diversity |
| **Hosting** | GitHub Pages | Free, reliable, version-controlled |
| **Version Control** | GitHub | Industry standard |

**Why**: Proven technologies reduce risk. Exotic stacks create exotic problems.

---

## File Structure

```
ft-tool-system-v4/
├── .github/
│   └── workflows/
│       └── deploy-tool.yml          # GitHub Action for tool deployment
│
├── backend/
│   ├── src/
│   │   ├── config/                  # Environment & secrets
│   │   ├── models/                  # Data schemas
│   │   ├── routes/                  # API endpoints
│   │   └── services/                # Business logic
│   └── package.json
│
├── src/                             # Boss Office frontend
│   ├── components/
│   │   ├── upload/                  # File upload + questionnaire
│   │   ├── inbox/                   # Job list view
│   │   ├── preview/                 # Tool preview + actions
│   │   └── success/                 # URL delivery modal
│   └── api/                         # API client
│
├── templates/                       # HTML tool templates
│   ├── b2b-product/
│   ├── b2b-service/
│   ├── b2c-product/
│   └── b2c-service/
│
├── context/                         # AI context documents
│   ├── approach.md                  # Company philosophy
│   ├── feedback.md                  # Lessons learned
│   └── criteria.md                  # 8-point criteria
│
├── specs/                           # Specification documents
│   ├── 01-admin-panel.md
│   ├── 02-backend-api.md
│   ├── 03-n8n-agents.md
│   ├── 04-templates.md
│   ├── 05-mongodb-schema.md
│   └── 06-deployment.md
│
├── n8n-workflows/                   # Workflow JSON exports
│   ├── tool-factory.json
│   ├── boss-revisions.json
│   └── deploy-tools.json
│
├── tools/                           # Generated tools live here
│   └── {tool-slug}/
│       └── index.html
│
├── CONSTITUTION.md                  # This document (supreme authority)
├── package.json
└── README.md
```

---

## Governance

### Constitutional Supremacy

This Constitution is the **supreme authority** for the Fast Track Tool Factory V4.

- All specs MUST align with this Constitution
- All code MUST implement what specs describe
- All AI prompts MUST enforce Constitutional principles
- Conflicts are resolved by referencing this document

### Amendment Process

This Constitution may be amended, but amendments require:

1. **Written proposal** explaining why change is needed
2. **Impact analysis** on existing specs and code
3. **Boss approval** (constitutional changes are Boss-level decisions)
4. **Version increment** and documentation of change
5. **Migration plan** if change affects existing tools

### Compliance Verification

Every PR must verify:
- [ ] Does this align with the Constitution?
- [ ] Does this follow the Factory Pipeline?
- [ ] Does this respect Boss Authority Supremacy?
- [ ] Does this maintain Single HTML File Output?
- [ ] Are Forbidden Words absent from tool output?

### Simplicity Guard

Before adding complexity, ask:
1. Is this required by the Constitution?
2. Is this required by the WOOP?
3. Will this make tool generation faster?
4. Will this make Boss's life easier?

If the answer to all four is NO, **do not add it**.

---

## The WOOP Anchor

This Constitution exists to fulfill the WOOP:

**WISH**: Create a tool building system that generates single HTML files based on admin input. Produce world-class educational tools where the value proposition is "Knowledge application."

**OUTCOME**: A system that produces world-class tools and saves significant time for the LMS rebuilding process.

**OBSTACLE**: Lack of understanding of GitHub, spec-kit development, and complex n8n workflows.

**PLAN**: Utilize spec-driven development for the admin panel, n8n for AI agent capabilities, and GitHub for version control and deployment.

Every decision in this system must serve this WOOP. If it doesn't, it doesn't belong.

---

**Version**: 4.0.0 | **Ratified**: 2026-01-28 | **Last Amended**: 2026-01-28

---

*"The tool is not the content. The tool is the decision. The decision is the product."*
