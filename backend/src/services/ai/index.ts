/**
 * Fast Track AI Services
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Central export for all AI-related services
 */

// Provider
export {
  callAI,
  callAIWithRetry,
  getProviderForRole,
  checkAIConfiguration,
  type AIProviderConfig,
  type AIResponse
} from './provider';

// Pipeline
export {
  runToolPipeline,
  runToolPipelineStreaming,
  estimatePipelineDuration,
  type PipelineInput,
  type PipelineResult,
  type PipelineProgress,
  type PipelineStage,
  type RevisionEntry
} from './pipeline';

// Agents
export { runSecretary, type SecretaryOutput, type ToolCategory } from './agents/secretary';
export { runBuilder, type ToolSpec, type Question, type WizardStep } from './agents/builder';
export { runTemplateDecider } from './agents/templateDecider';
export { runQA, meetsPassThreshold, type QAResult, type CriteriaScores } from './agents/qa';
export { runFeedbackApplier, applyBossRevision } from './agents/feedbackApplier';
