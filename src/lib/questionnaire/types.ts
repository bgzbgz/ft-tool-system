/**
 * Fast Track Pre-Submission Questionnaire - Types
 * Spec: 014-pre-submission-questionnaire
 * Per contracts/questionnaire-state.yaml and contracts/submit-payload.yaml
 */

// ========== TOOL CATEGORY OPTIONS ==========

/**
 * Tool category - determines template and AI prompts
 */
export type ToolCategory = 'b2b_product' | 'b2b_service' | 'b2c_product' | 'b2c_service';

export const TOOL_CATEGORY_OPTIONS: { value: ToolCategory; label: string; description: string }[] = [
  { value: 'b2b_product', label: 'B2B Product', description: 'Business evaluating a product purchase (software, equipment, etc.)' },
  { value: 'b2b_service', label: 'B2B Service', description: 'Business evaluating a service provider (agency, consultant, etc.)' },
  { value: 'b2c_product', label: 'B2C Product', description: 'Individual making a personal product purchase' },
  { value: 'b2c_service', label: 'B2C Service', description: 'Individual evaluating a personal service (coaching, fitness, etc.)' }
];

// ========== INPUT TYPE OPTIONS ==========

/**
 * Predefined options for Q3 multi-select
 */
export type InputTypeOption = 'numbers' | 'yesno' | 'rating' | 'multiple' | 'text';

export const INPUT_TYPE_OPTIONS: { value: InputTypeOption; label: string }[] = [
  { value: 'numbers', label: 'Numbers/Metrics' },
  { value: 'yesno', label: 'Yes/No Questions' },
  { value: 'rating', label: 'Rating Scales' },
  { value: 'multiple', label: 'Multiple Choice' },
  { value: 'text', label: 'Text Responses' }
];

// ========== QUESTIONNAIRE STATE ==========

/**
 * Contains the user's responses to all questions
 */
export interface QuestionnaireAnswers {
  category: ToolCategory;
  decision: string;
  teaching: string;
  inputTypes: InputTypeOption[];
  scoringCriteria: string;
}

/**
 * Complete state of the questionnaire form
 */
export interface QuestionnaireState {
  currentStep: number; // 1-5 (5 = review)
  answers: QuestionnaireAnswers;
  isSubmitting: boolean;
  lastUpdated: string | null;
}

// ========== QUESTION CONFIG ==========

export type QuestionInputType = 'text' | 'multiselect' | 'category';

/**
 * Configuration for each question step
 */
export interface QuestionConfig {
  id: keyof QuestionnaireAnswers;
  step: number;
  question: string;
  inputType: QuestionInputType;
  placeholder?: string;
  options?: { value: string; label: string; description?: string }[];
  maxLength: number;
}

// ========== API PAYLOAD ==========

/**
 * The source object nested in the payload
 */
export interface ToolRequestSource {
  category: ToolCategory;
  decision: string;
  teaching: string;
  input_types: InputTypeOption[];
  scoring_criteria: string;
}

/**
 * The final JSON payload sent to the API
 */
export interface ToolRequestPayload {
  source: ToolRequestSource;
}

/**
 * Response from job creation API
 */
export interface CreateJobResponse {
  job_id: string;
  status: string;
}

// ========== VALIDATION ==========

export interface ValidationResult {
  valid: boolean;
  error?: string;
}
