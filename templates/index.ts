/**
 * Tool Category Templates
 *
 * Each category has:
 * - prompts.md: AI system prompts specific to the category
 * - template.html: HTML shell template for the category
 * - scoring.ts: Custom scoring logic
 * - config.json: Category-specific configuration
 */

export type ToolCategory = 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';

export interface CategoryConfig {
  id: ToolCategory;
  name: string;
  description: string;
  targetAudience: string;
  decisionFocus: string;
  typicalTools: string[];
  promptAdditions: string;
  scoringWeights: ScoringWeights;
  htmlTemplate: string;
}

export interface ScoringWeights {
  decision_clarity: number;
  roi_focus: number;
  time_to_value: number;
  risk_assessment: number;
  commitment_strength: number;
}

// ========== B2B PRODUCT CONFIG ==========

export const B2B_PRODUCT: CategoryConfig = {
  id: 'b2b_product',
  name: 'B2B Product',
  description: 'Tools for businesses evaluating product purchases',
  targetAudience: 'Business decision makers evaluating software, equipment, or physical products for their company',
  decisionFocus: 'ROI, integration complexity, vendor reliability, total cost of ownership',
  typicalTools: [
    'Software Selection Canvas',
    'Build vs Buy Decision Tool',
    'Vendor Comparison Matrix',
    'Technology Stack Assessment',
    'Equipment ROI Calculator'
  ],
  promptAdditions: `
## B2B PRODUCT CONTEXT

The user making this decision is a business leader evaluating a PRODUCT purchase.

Key considerations for B2B product decisions:
- Total Cost of Ownership (TCO) - not just purchase price
- Integration with existing systems
- Vendor stability and support quality
- Implementation timeline and resource requirements
- Scalability for future growth
- Security and compliance requirements
- Training and change management costs

Your tool MUST:
1. Calculate or estimate ROI within the tool
2. Include integration/compatibility assessment
3. Force a GO/NO-GO decision with specific vendor/product recommendation
4. Include timeline for implementation decision

AVOID:
- Generic feature comparisons without business impact
- Vague "it depends" conclusions
- Missing the total cost perspective
`,
  scoringWeights: {
    decision_clarity: 25,
    roi_focus: 30,
    time_to_value: 15,
    risk_assessment: 20,
    commitment_strength: 10
  },
  htmlTemplate: 'b2b-product'
};

// ========== B2B SERVICE CONFIG ==========

export const B2B_SERVICE: CategoryConfig = {
  id: 'b2b_service',
  name: 'B2B Service',
  description: 'Tools for businesses evaluating service providers or consulting engagements',
  targetAudience: 'Business leaders deciding on agencies, consultants, outsourcing partners, or professional services',
  decisionFocus: 'Provider capability, cultural fit, pricing model, track record, ongoing relationship',
  typicalTools: [
    'Agency Selection Canvas',
    'Outsourcing Decision Tool',
    'Consulting Engagement Evaluator',
    'Partnership Fit Assessment',
    'Vendor Due Diligence Canvas'
  ],
  promptAdditions: `
## B2B SERVICE CONTEXT

The user is evaluating a SERVICE provider relationship (agency, consultant, outsourcing partner).

Key considerations for B2B service decisions:
- Provider expertise and track record
- Cultural and communication fit
- Pricing model alignment (retainer vs project vs outcome-based)
- Scalability of the relationship
- Knowledge transfer and IP considerations
- Exit strategy and switching costs
- Reference checks and case studies

Your tool MUST:
1. Assess cultural/communication fit (not just capability)
2. Evaluate pricing model suitability for their needs
3. Include red flags checklist
4. Force a HIRE/DON'T HIRE decision with specific action
5. Include contract negotiation priorities if HIRE

AVOID:
- Focusing only on cost comparison
- Ignoring relationship dynamics
- Missing the long-term partnership perspective
`,
  scoringWeights: {
    decision_clarity: 20,
    roi_focus: 20,
    time_to_value: 15,
    risk_assessment: 25,
    commitment_strength: 20
  },
  htmlTemplate: 'b2b-service'
};

// ========== B2C PRODUCT CONFIG ==========

export const B2C_PRODUCT: CategoryConfig = {
  id: 'b2c_product',
  name: 'B2C Product',
  description: 'Tools for consumers making personal product purchases',
  targetAudience: 'Individual consumers deciding on personal purchases - electronics, vehicles, home goods, etc.',
  decisionFocus: 'Value for money, personal needs fit, lifestyle alignment, budget constraints',
  typicalTools: [
    'Car Buying Decision Canvas',
    'Home Purchase Readiness Tool',
    'Tech Upgrade Evaluator',
    'Major Purchase Justifier',
    'Lifestyle Product Fit Assessment'
  ],
  promptAdditions: `
## B2C PRODUCT CONTEXT

The user is making a PERSONAL product purchase decision.

Key considerations for B2C product decisions:
- Budget and financing options
- Personal needs vs wants clarity
- Lifestyle fit and daily use patterns
- Long-term value vs immediate gratification
- Comparison with alternatives
- Timing - is now the right time?
- Emotional vs rational factors

Your tool MUST:
1. Separate needs from wants explicitly
2. Include budget reality check
3. Address the "should I wait?" question
4. Force a BUY NOW / WAIT / SKIP decision
5. If BUY NOW - specify exactly which option

AVOID:
- Overcomplicating with business metrics
- Ignoring emotional/lifestyle factors
- Being preachy about spending
`,
  scoringWeights: {
    decision_clarity: 30,
    roi_focus: 15,
    time_to_value: 20,
    risk_assessment: 15,
    commitment_strength: 20
  },
  htmlTemplate: 'b2c-product'
};

// ========== B2C SERVICE CONFIG ==========

export const B2C_SERVICE: CategoryConfig = {
  id: 'b2c_service',
  name: 'B2C Service',
  description: 'Tools for consumers evaluating personal services',
  targetAudience: 'Individuals deciding on personal services - coaching, fitness, education, home services, etc.',
  decisionFocus: 'Personal fit, value alignment, trust, convenience, results track record',
  typicalTools: [
    'Coach/Mentor Selection Canvas',
    'Gym/Fitness Program Chooser',
    'Course/Education Investment Tool',
    'Home Service Provider Evaluator',
    'Subscription Service Auditor'
  ],
  promptAdditions: `
## B2C SERVICE CONTEXT

The user is evaluating a PERSONAL service (coaching, education, fitness, etc.).

Key considerations for B2C service decisions:
- Personal chemistry and trust
- Track record with similar clients
- Value alignment with provider
- Commitment level required
- Results timeline expectations
- Cost vs transformation value
- Accountability mechanisms

Your tool MUST:
1. Assess personal readiness for the service
2. Evaluate provider fit beyond credentials
3. Set realistic outcome expectations
4. Force a COMMIT / NOT READY / WRONG FIT decision
5. If COMMIT - include accountability mechanism

AVOID:
- Treating personal services like business transactions
- Ignoring the relationship/trust element
- Focusing only on credentials over fit
`,
  scoringWeights: {
    decision_clarity: 25,
    roi_focus: 15,
    time_to_value: 15,
    risk_assessment: 20,
    commitment_strength: 25
  },
  htmlTemplate: 'b2c-service'
};

// ========== CATEGORY REGISTRY ==========

export const CATEGORIES: Record<ToolCategory, CategoryConfig> = {
  b2b_product: B2B_PRODUCT,
  b2b_service: B2B_SERVICE,
  b2c_product: B2C_PRODUCT,
  b2c_service: B2C_SERVICE
};

export function getCategoryConfig(category: ToolCategory): CategoryConfig {
  return CATEGORIES[category] || B2B_SERVICE; // Default to B2B service
}

export function getAllCategories(): CategoryConfig[] {
  return Object.values(CATEGORIES);
}

export function isValidCategory(category: string): category is ToolCategory {
  return category in CATEGORIES;
}

// ========== AI PROMPT BUILDER ==========

export function buildCategoryPrompt(category: ToolCategory, basePrompt: string): string {
  const config = getCategoryConfig(category);

  return `${basePrompt}

${config.promptAdditions}

## TARGET AUDIENCE
${config.targetAudience}

## DECISION FOCUS
${config.decisionFocus}

## EXAMPLE TOOLS IN THIS CATEGORY
${config.typicalTools.map(t => `- ${t}`).join('\n')}
`;
}

// ========== SCORING CALCULATOR ==========

export interface ScoreInput {
  decision_clarity: number;  // 0-100
  roi_focus: number;         // 0-100
  time_to_value: number;     // 0-100
  risk_assessment: number;   // 0-100
  commitment_strength: number; // 0-100
}

export function calculateCategoryScore(category: ToolCategory, scores: ScoreInput): number {
  const weights = getCategoryConfig(category).scoringWeights;
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const weightedScore = (
    scores.decision_clarity * weights.decision_clarity +
    scores.roi_focus * weights.roi_focus +
    scores.time_to_value * weights.time_to_value +
    scores.risk_assessment * weights.risk_assessment +
    scores.commitment_strength * weights.commitment_strength
  ) / totalWeight;

  return Math.round(weightedScore);
}
