# V4 Templates: Tool Template Configuration

> **Purpose**: Define the 4 category templates and their functionality
> **Location**: Templates are embedded in the Template Decider Agent or stored in MongoDB

---

## Template Overview

Each template follows the same Fast Track design system but has different functionality suited to its category:

| Template | Category | Primary Functionality | Decision Type |
|----------|----------|----------------------|---------------|
| `b2b-product` | Business → Product | ROI Calculator, TCO Analysis | GO / NO-GO |
| `b2b-service` | Business → Service | Fit Assessment, Red Flags | HIRE / DON'T HIRE |
| `b2c-product` | Consumer → Product | Needs vs Wants, Budget Check | BUY NOW / WAIT / SKIP |
| `b2c-service` | Consumer → Service | Readiness Assessment, Commitment | COMMIT / NOT READY / WRONG FIT |

---

## Shared Design System

All templates share these design elements:

### Colors
```css
:root {
  --ft-orange: #FF6B35;
  --ft-dark: #1A1A2E;
  --ft-light: #F5F5F5;
  --ft-success: #10B981;
  --ft-warning: #F59E0B;
  --ft-danger: #EF4444;
  --ft-gradient: linear-gradient(135deg, #FF6B35 0%, #FF8C5A 100%);
}
```

### Typography
```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  line-height: 1.6;
}

h1, h2, h3 {
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

### Layout Structure
```html
<div class="ft-tool" data-category="b2b_service">
  <!-- Header -->
  <header class="ft-header">
    <div class="ft-logo">Fast Track</div>
    <h1 class="ft-title">[Tool Name]</h1>
    <p class="ft-tagline">[Tagline]</p>
  </header>

  <!-- Progress Bar -->
  <div class="ft-progress">
    <div class="ft-progress-bar" style="width: 0%"></div>
    <span class="ft-progress-text">0%</span>
  </div>

  <!-- Questions Container -->
  <main class="ft-questions">
    <!-- Questions injected here -->
  </main>

  <!-- Verdict Section (hidden until complete) -->
  <section class="ft-verdict" style="display: none;">
    <!-- Verdict content -->
  </section>

  <!-- Commitment Section (hidden until verdict shown) -->
  <section class="ft-commitment" style="display: none;">
    <!-- Commitment capture -->
  </section>
</div>
```

---

## Template 1: B2B Product

**File**: `templates/b2b-product.html`

### Functionality
- **ROI Calculator**: Estimates return on investment
- **TCO Breakdown**: Total cost of ownership analysis
- **Integration Checklist**: Compatibility with existing systems
- **Timeline Estimator**: Implementation time projection

### Key Components

```html
<!-- ROI Calculator Section -->
<div class="ft-section ft-roi-calculator">
  <h2>ROI Analysis</h2>

  <div class="ft-input-group">
    <label>Expected Annual Benefit ($)</label>
    <input type="number" id="annual-benefit" placeholder="50000">
  </div>

  <div class="ft-input-group">
    <label>Product Cost ($)</label>
    <input type="number" id="product-cost" placeholder="15000">
  </div>

  <div class="ft-input-group">
    <label>Implementation Cost ($)</label>
    <input type="number" id="impl-cost" placeholder="5000">
  </div>

  <div class="ft-roi-result">
    <span class="ft-roi-label">Projected ROI</span>
    <span class="ft-roi-value" id="roi-value">--</span>
    <span class="ft-roi-period">First Year</span>
  </div>
</div>

<!-- TCO Breakdown -->
<div class="ft-section ft-tco">
  <h2>Total Cost of Ownership (3 Years)</h2>

  <div class="ft-tco-item">
    <span>Initial Purchase</span>
    <span id="tco-initial">$0</span>
  </div>
  <div class="ft-tco-item">
    <span>Implementation</span>
    <span id="tco-impl">$0</span>
  </div>
  <div class="ft-tco-item">
    <span>Training</span>
    <span id="tco-training">$0</span>
  </div>
  <div class="ft-tco-item">
    <span>Maintenance (Annual)</span>
    <span id="tco-maintenance">$0</span>
  </div>
  <div class="ft-tco-total">
    <span>3-Year TCO</span>
    <span id="tco-total">$0</span>
  </div>
</div>

<!-- Integration Checklist -->
<div class="ft-section ft-checklist">
  <h2>Integration Compatibility</h2>

  <div class="ft-check-item">
    <input type="checkbox" id="check-api">
    <label for="check-api">Has API for our existing systems</label>
  </div>
  <div class="ft-check-item">
    <input type="checkbox" id="check-data">
    <label for="check-data">Supports our data formats</label>
  </div>
  <div class="ft-check-item">
    <input type="checkbox" id="check-sso">
    <label for="check-sso">SSO/authentication compatible</label>
  </div>
  <!-- More checks... -->
</div>
```

### Verdict Logic
```javascript
function calculateVerdict() {
  const roi = calculateROI();
  const integrationScore = getIntegrationScore();
  const riskScore = getRiskScore();

  // Weighted scoring
  const totalScore = (roi * 0.4) + (integrationScore * 0.35) + (riskScore * 0.25);

  if (totalScore >= 70) {
    return {
      verdict: 'GO',
      confidence: totalScore >= 85 ? 'high' : 'medium',
      message: 'This product is a solid investment for your business.',
      nextSteps: [
        'Request final pricing and contract terms',
        'Schedule implementation kickoff meeting',
        'Prepare internal announcement'
      ]
    };
  } else if (totalScore >= 50) {
    return {
      verdict: 'CONDITIONAL GO',
      confidence: 'low',
      message: 'Proceed with caution. Address the flagged concerns first.',
      conditions: getConditions()
    };
  } else {
    return {
      verdict: 'NO-GO',
      confidence: totalScore < 30 ? 'high' : 'medium',
      message: 'This product doesn\'t meet your requirements.',
      alternatives: 'Consider other options or re-evaluate your needs.'
    };
  }
}
```

---

## Template 2: B2B Service

**File**: `templates/b2b-service.html`

### Functionality
- **Fit Assessment**: Cultural and skill fit scoring
- **Red Flags Detector**: Warning signs identification
- **Pricing Model Analyzer**: Compare pricing structures
- **Negotiation Priorities**: If HIRE, what to negotiate

### Key Components

```html
<!-- Fit Assessment -->
<div class="ft-section ft-fit-assessment">
  <h2>Provider Fit Assessment</h2>

  <div class="ft-slider-group">
    <label>Industry Expertise</label>
    <input type="range" min="1" max="5" value="3" id="industry-expertise">
    <div class="ft-slider-labels">
      <span>No experience</span>
      <span>Deep expertise</span>
    </div>
  </div>

  <div class="ft-slider-group">
    <label>Communication Style Fit</label>
    <input type="range" min="1" max="5" value="3" id="comm-fit">
    <div class="ft-slider-labels">
      <span>Misaligned</span>
      <span>Perfect match</span>
    </div>
  </div>

  <div class="ft-slider-group">
    <label>Budget Alignment</label>
    <input type="range" min="1" max="5" value="3" id="budget-fit">
    <div class="ft-slider-labels">
      <span>Way over budget</span>
      <span>Within budget</span>
    </div>
  </div>

  <div class="ft-fit-score">
    <div class="ft-fit-circle" id="fit-circle">
      <span class="ft-fit-number">0</span>
      <span class="ft-fit-label">FIT SCORE</span>
    </div>
  </div>
</div>

<!-- Red Flags Detector -->
<div class="ft-section ft-red-flags">
  <h2>Red Flags Check</h2>

  <div class="ft-flag-item" data-severity="red">
    <input type="checkbox" id="flag-no-references">
    <label for="flag-no-references">Won't provide client references</label>
    <span class="ft-flag-badge ft-red">🚩 Deal Breaker</span>
  </div>

  <div class="ft-flag-item" data-severity="red">
    <input type="checkbox" id="flag-vague-pricing">
    <label for="flag-vague-pricing">Can't explain pricing clearly</label>
    <span class="ft-flag-badge ft-red">🚩 Deal Breaker</span>
  </div>

  <div class="ft-flag-item" data-severity="yellow">
    <input type="checkbox" id="flag-high-turnover">
    <label for="flag-high-turnover">High team turnover mentioned</label>
    <span class="ft-flag-badge ft-yellow">⚠️ Caution</span>
  </div>

  <div class="ft-flag-item" data-severity="yellow">
    <input type="checkbox" id="flag-no-process">
    <label for="flag-no-process">No clear process or methodology</label>
    <span class="ft-flag-badge ft-yellow">⚠️ Caution</span>
  </div>

  <!-- More flags... -->
</div>

<!-- Negotiation Priorities (shown on HIRE) -->
<div class="ft-section ft-negotiation" style="display: none;">
  <h2>Your Negotiation Priorities</h2>

  <div class="ft-priority-list" id="priority-list">
    <!-- Dynamically generated based on assessment -->
  </div>
</div>
```

### Verdict Logic
```javascript
function calculateVerdict() {
  const fitScore = getFitScore();
  const redFlags = getRedFlags();
  const yellowFlags = getYellowFlags();

  // Red flags are deal breakers
  if (redFlags.length > 0) {
    return {
      verdict: "DON'T HIRE",
      confidence: 'high',
      message: `${redFlags.length} deal-breaker(s) detected.`,
      redFlags: redFlags,
      recommendation: 'Walk away. These issues rarely resolve themselves.'
    };
  }

  // Calculate final score (yellow flags reduce score)
  const adjustedScore = fitScore - (yellowFlags.length * 10);

  if (adjustedScore >= 70) {
    return {
      verdict: 'HIRE',
      confidence: adjustedScore >= 85 ? 'high' : 'medium',
      message: 'This provider is a good fit for your needs.',
      yellowFlags: yellowFlags,
      negotiationPriorities: generateNegotiationPriorities(yellowFlags)
    };
  } else if (adjustedScore >= 55) {
    return {
      verdict: 'CONDITIONAL HIRE',
      confidence: 'low',
      message: 'Proceed only if you can address these concerns:',
      conditions: generateConditions(yellowFlags),
      negotiationPriorities: generateNegotiationPriorities(yellowFlags)
    };
  } else {
    return {
      verdict: "DON'T HIRE",
      confidence: 'medium',
      message: 'Too many concerns. Keep looking.',
      yellowFlags: yellowFlags
    };
  }
}
```

---

## Template 3: B2C Product

**File**: `templates/b2c-product.html`

### Functionality
- **Needs vs Wants Separator**: Distinguish essential from nice-to-have
- **Budget Reality Check**: Can you actually afford it?
- **Timing Advisor**: Is now the right time?
- **Comparison Helper**: Compare options if multiple

### Key Components

```html
<!-- Needs vs Wants -->
<div class="ft-section ft-needs-wants">
  <h2>Why Do You Want This?</h2>
  <p class="ft-instruction">Drag each reason to NEED or WANT</p>

  <div class="ft-drag-container">
    <div class="ft-drag-items" id="reasons-list">
      <!-- Dynamically populated based on product type -->
    </div>

    <div class="ft-drag-zones">
      <div class="ft-zone ft-zone-need" id="needs-zone">
        <h3>NEEDS</h3>
        <p>I genuinely require this</p>
      </div>
      <div class="ft-zone ft-zone-want" id="wants-zone">
        <h3>WANTS</h3>
        <p>Nice to have</p>
      </div>
    </div>
  </div>

  <div class="ft-needs-score">
    <span id="needs-count">0</span> needs vs <span id="wants-count">0</span> wants
  </div>
</div>

<!-- Budget Reality Check -->
<div class="ft-section ft-budget">
  <h2>Budget Reality Check</h2>

  <div class="ft-input-group">
    <label>Product Price</label>
    <input type="number" id="price" placeholder="1000">
  </div>

  <div class="ft-input-group">
    <label>Your Monthly Income (After Tax)</label>
    <input type="number" id="income" placeholder="5000">
  </div>

  <div class="ft-input-group">
    <label>Current Savings</label>
    <input type="number" id="savings" placeholder="10000">
  </div>

  <div class="ft-budget-analysis">
    <div class="ft-budget-item">
      <span>Price as % of Monthly Income</span>
      <span id="income-percent">--</span>
    </div>
    <div class="ft-budget-item">
      <span>Price as % of Savings</span>
      <span id="savings-percent">--</span>
    </div>
    <div class="ft-budget-verdict" id="budget-verdict">
      <!-- Affordable / Stretch / Can't Afford -->
    </div>
  </div>
</div>

<!-- Timing Advisor -->
<div class="ft-section ft-timing">
  <h2>Is Now The Right Time?</h2>

  <div class="ft-option-group">
    <label class="ft-option">
      <input type="radio" name="timing" value="urgent">
      <span>I need this NOW - can't wait</span>
    </label>
    <label class="ft-option">
      <input type="radio" name="timing" value="soon">
      <span>Want it soon, but could wait a few weeks</span>
    </label>
    <label class="ft-option">
      <input type="radio" name="timing" value="eventually">
      <span>No rush - just researching</span>
    </label>
  </div>

  <div class="ft-timing-factors">
    <div class="ft-factor">
      <input type="checkbox" id="factor-sale">
      <label>Currently on sale/discount</label>
    </div>
    <div class="ft-factor">
      <input type="checkbox" id="factor-season">
      <label>Seasonal item (won't be available later)</label>
    </div>
    <div class="ft-factor">
      <input type="checkbox" id="factor-replace">
      <label>Replacing something broken/unusable</label>
    </div>
  </div>
</div>
```

### Verdict Logic
```javascript
function calculateVerdict() {
  const needsScore = getNeedsScore(); // More needs = higher score
  const budgetStatus = getBudgetStatus(); // 'affordable', 'stretch', 'cant_afford'
  const timingUrgency = getTimingUrgency();
  const timingFactors = getTimingFactors();

  // Can't afford = always SKIP
  if (budgetStatus === 'cant_afford') {
    return {
      verdict: 'SKIP',
      confidence: 'high',
      message: "This purchase would put you in financial stress.",
      suggestion: calculateSavingsGoal()
    };
  }

  // Few real needs + no urgency = WAIT
  if (needsScore < 30 && timingUrgency !== 'urgent') {
    return {
      verdict: 'WAIT',
      confidence: 'high',
      message: "This is mostly a 'want'. Sleep on it.",
      waitPeriod: '30 days',
      reminder: 'If you still want it in a month, reconsider.'
    };
  }

  // High needs + affordable + good timing = BUY NOW
  if (needsScore >= 60 && budgetStatus === 'affordable') {
    return {
      verdict: 'BUY NOW',
      confidence: 'high',
      message: "This is a justified purchase that fits your budget.",
      recommendation: getBestOption(),
      tips: getPurchaseTips()
    };
  }

  // Mixed signals
  return {
    verdict: 'WAIT',
    confidence: 'medium',
    message: "Not a clear yes. Give it more thought.",
    concerns: getConcerns(),
    reconsiderWhen: getReconsiderConditions()
  };
}
```

---

## Template 4: B2C Service

**File**: `templates/b2c-service.html`

### Functionality
- **Readiness Meter**: Are you ready to commit?
- **Provider Fit Beyond Credentials**: Chemistry and values
- **Commitment Tracker**: What will you commit to?
- **Goal Alignment**: Match expectations with reality

### Key Components

```html
<!-- Readiness Assessment -->
<div class="ft-section ft-readiness">
  <h2>Are You Ready For This?</h2>

  <div class="ft-readiness-question">
    <p>How much time can you dedicate weekly?</p>
    <div class="ft-option-group">
      <label class="ft-option">
        <input type="radio" name="time" value="1">
        <span>Less than 1 hour</span>
      </label>
      <label class="ft-option">
        <input type="radio" name="time" value="2">
        <span>1-3 hours</span>
      </label>
      <label class="ft-option">
        <input type="radio" name="time" value="3">
        <span>3-5 hours</span>
      </label>
      <label class="ft-option">
        <input type="radio" name="time" value="4">
        <span>5+ hours</span>
      </label>
    </div>
  </div>

  <div class="ft-readiness-question">
    <p>How would you rate your current motivation?</p>
    <div class="ft-motivation-scale">
      <input type="range" min="1" max="10" value="5" id="motivation">
      <div class="ft-scale-labels">
        <span>Meh</span>
        <span>On Fire</span>
      </div>
    </div>
  </div>

  <div class="ft-readiness-question">
    <p>What's driving this decision?</p>
    <div class="ft-option-group">
      <label class="ft-option">
        <input type="checkbox" name="driver" value="internal">
        <span>Personal desire for change</span>
      </label>
      <label class="ft-option">
        <input type="checkbox" name="driver" value="external">
        <span>External pressure (boss, family, etc.)</span>
      </label>
      <label class="ft-option">
        <input type="checkbox" name="driver" value="crisis">
        <span>Crisis/urgent situation</span>
      </label>
    </div>
  </div>

  <div class="ft-readiness-meter">
    <div class="ft-meter-fill" id="readiness-fill"></div>
    <span class="ft-meter-label" id="readiness-label">Not Ready</span>
  </div>
</div>

<!-- Provider Chemistry -->
<div class="ft-section ft-chemistry">
  <h2>Provider Chemistry Check</h2>

  <div class="ft-chemistry-item">
    <p>After talking to them, I felt:</p>
    <div class="ft-emotion-scale">
      <button class="ft-emotion" data-value="1">😬 Uncomfortable</button>
      <button class="ft-emotion" data-value="2">😐 Neutral</button>
      <button class="ft-emotion" data-value="3">🙂 Good</button>
      <button class="ft-emotion" data-value="4">😊 Energized</button>
    </div>
  </div>

  <div class="ft-chemistry-item">
    <p>Do they understand your specific situation?</p>
    <div class="ft-yes-no">
      <button class="ft-yn" data-value="yes">Yes, completely</button>
      <button class="ft-yn" data-value="partial">Somewhat</button>
      <button class="ft-yn" data-value="no">Not really</button>
    </div>
  </div>

  <div class="ft-chemistry-item">
    <p>Do their values align with yours?</p>
    <div class="ft-yes-no">
      <button class="ft-yn" data-value="yes">Definitely</button>
      <button class="ft-yn" data-value="partial">Mostly</button>
      <button class="ft-yn" data-value="no">Not sure</button>
    </div>
  </div>
</div>

<!-- Commitment Capture -->
<div class="ft-section ft-commitment-capture" style="display: none;">
  <h2>Your Commitment</h2>

  <p>To make this work, I commit to:</p>

  <div class="ft-commitment-items">
    <label class="ft-commitment-item">
      <input type="checkbox" id="commit-time">
      <span>Dedicating <strong id="commit-time-value">X</strong> hours per week</span>
    </label>
    <label class="ft-commitment-item">
      <input type="checkbox" id="commit-homework">
      <span>Completing all homework/exercises</span>
    </label>
    <label class="ft-commitment-item">
      <input type="checkbox" id="commit-honest">
      <span>Being honest about challenges</span>
    </label>
    <label class="ft-commitment-item">
      <input type="checkbox" id="commit-duration">
      <span>Sticking with it for at least <strong id="commit-duration-value">3 months</strong></span>
    </label>
  </div>

  <div class="ft-accountability">
    <label>Who will hold you accountable?</label>
    <input type="text" id="accountability-person" placeholder="Name of friend/family member">
  </div>
</div>
```

### Verdict Logic
```javascript
function calculateVerdict() {
  const readinessScore = getReadinessScore();
  const chemistryScore = getChemistryScore();
  const motivationSource = getMotivationSource();

  // External pressure only = NOT READY
  if (motivationSource === 'external_only') {
    return {
      verdict: 'NOT READY',
      confidence: 'high',
      message: "You're doing this for others, not yourself. That rarely works.",
      suggestion: "Wait until YOU want this, not just others around you."
    };
  }

  // Low readiness + low chemistry = WRONG FIT
  if (readinessScore < 40 && chemistryScore < 50) {
    return {
      verdict: 'WRONG FIT',
      confidence: 'high',
      message: "Neither the timing nor the provider is right.",
      nextSteps: [
        "Work on your readiness first",
        "Explore other providers",
        "Revisit when circumstances change"
      ]
    };
  }

  // High readiness + good chemistry = COMMIT
  if (readinessScore >= 70 && chemistryScore >= 60) {
    return {
      verdict: 'COMMIT',
      confidence: readinessScore >= 85 ? 'high' : 'medium',
      message: "You're ready and you've found a good match. Go for it.",
      commitmentItems: generateCommitmentItems(),
      successFactors: getSuccessFactors()
    };
  }

  // Mixed = NOT READY (default to caution)
  return {
    verdict: 'NOT READY',
    confidence: 'medium',
    message: "Something's holding you back. Address it first.",
    blockers: identifyBlockers(),
    prepWork: getPrepWork()
  };
}
```

---

## Storing Templates

Templates can be stored in two ways:

### Option 1: MongoDB Collection

Store templates in `context_documents` collection:

```javascript
{
  _id: "template_b2b_service",
  type: "template",
  template_id: "b2b-service",
  category: "b2b_service",
  html: "<!DOCTYPE html>...",
  version: "4.0",
  updated_at: ISODate()
}
```

The Template Decider Agent fetches the template from MongoDB.

### Option 2: HTML Nodes in n8n

Store each template as an HTML node in n8n, then use a Switch node to route to the correct one.

### Option 3: GitHub Repository

Store templates in `/templates/` folder and have the Template Decider Agent fetch via GitHub API.

---

## Template Selection Flow

```javascript
// In Template Decider Agent
const category = input.category; // e.g., 'b2b_service'
const categoryConfig = input.category_config;
const templateHint = categoryConfig.template_hint; // e.g., 'assessment'

// Select template
let templateId;
switch (category) {
  case 'b2b_product':
    templateId = 'b2b-product';
    break;
  case 'b2b_service':
    templateId = 'b2b-service';
    break;
  case 'b2c_product':
    templateId = 'b2c-product';
    break;
  case 'b2c_service':
    templateId = 'b2c-service';
    break;
  default:
    templateId = 'b2b-service'; // fallback
}

// Fetch template HTML
const template = await fetchTemplate(templateId);

// Inject content from markdown spec
const finalHtml = populateTemplate(template, markdownSpec);
```

---

## Best Practices

1. **All templates must satisfy the 8-point criteria** (unless boss overrides)
2. **Mobile-first responsive design** - test on 320px width
3. **Instant feedback** - every interaction shows immediate response
4. **No instructions** - tool must be self-evident
5. **Clear verdicts** - unambiguous decision language
6. **Commitment capture** - always ask for next action
7. **Fast Track DNA** - bold, direct, no hedge words
8. **Self-contained** - all CSS/JS inline in single HTML file
