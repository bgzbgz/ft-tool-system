/**
 * Fast Track Tool Generator Service
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Replaces the n8n webhook-based factory.ts
 * Generates tools using the in-house AI pipeline
 */

import { Job, JobStatus } from '../models/job';
import { retrieveFile } from './storage';
import {
  runToolPipeline,
  PipelineInput,
  PipelineResult,
  PipelineProgress,
  checkAIConfiguration
} from './ai';

// ========== INTERFACES ==========

export interface GenerateResult {
  success: boolean;
  toolName?: string;
  toolSlug?: string;
  toolHtml?: string;
  toolDescription?: string;
  category?: string;
  qaScore?: number;
  qaReport?: {
    score: number;
    result: 'PASS' | 'FAIL';
    issues: string[];
    recommendations: string[];
  };
  revisionCount?: number;
  error?: string;
  errorCode?: GenerateErrorCode;
}

export type GenerateErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'FILE_NOT_FOUND'
  | 'PIPELINE_ERROR'
  | 'QA_FAILED'
  | 'INVALID_FILE_TYPE';

// ========== ERROR MESSAGES ==========

const ERROR_MESSAGES: Record<GenerateErrorCode, string> = {
  AI_NOT_CONFIGURED: 'AI providers not configured. Check API keys.',
  FILE_NOT_FOUND: 'File not found. Re-upload the document.',
  PIPELINE_ERROR: 'Tool generation failed. Try again.',
  QA_FAILED: 'Tool failed quality validation after multiple attempts.',
  INVALID_FILE_TYPE: 'File type not supported for text extraction.'
};

// ========== MAIN FUNCTION ==========

/**
 * Generate a tool from a job using the in-house AI pipeline
 *
 * @param job - The job containing the source file
 * @param onProgress - Optional callback for progress updates
 * @returns GenerateResult with the generated tool or error
 */
export async function generateTool(
  job: Job,
  onProgress?: (progress: PipelineProgress) => void
): Promise<GenerateResult> {
  console.log(`[ToolGenerator] Starting generation for job ${job.job_id}...`);

  // Step 0: Check AI configuration
  const configCheck = checkAIConfiguration();
  if (!configCheck.valid) {
    console.log(`[ToolGenerator] AI not configured: ${configCheck.missing.join(', ')}`);
    return {
      success: false,
      error: ERROR_MESSAGES.AI_NOT_CONFIGURED,
      errorCode: 'AI_NOT_CONFIGURED'
    };
  }

  // Step 1: Retrieve file content
  let fileBuffer: Buffer;
  try {
    fileBuffer = await retrieveFile(job.file_storage_key);
    console.log(`[ToolGenerator] File retrieved: ${fileBuffer.length} bytes`);
  } catch (error) {
    console.log(`[ToolGenerator] File not found: ${job.file_storage_key}`);
    return {
      success: false,
      error: ERROR_MESSAGES.FILE_NOT_FOUND,
      errorCode: 'FILE_NOT_FOUND'
    };
  }

  // Step 2: Extract text from file
  let sourceText: string;
  try {
    sourceText = await extractText(fileBuffer, job.file_type);
    console.log(`[ToolGenerator] Text extracted: ${sourceText.length} characters`);
  } catch (error) {
    console.log(`[ToolGenerator] Text extraction failed: ${error}`);
    return {
      success: false,
      error: ERROR_MESSAGES.INVALID_FILE_TYPE,
      errorCode: 'INVALID_FILE_TYPE'
    };
  }

  // Step 3: Run AI pipeline
  const pipelineInput: PipelineInput = {
    jobId: job.job_id,
    sourceText,
    fileMetadata: {
      filename: job.original_filename,
      fileType: job.file_type
    }
  };

  let pipelineResult: PipelineResult;
  try {
    pipelineResult = await runToolPipeline(pipelineInput, onProgress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[ToolGenerator] Pipeline error: ${errorMessage}`);
    return {
      success: false,
      error: `${ERROR_MESSAGES.PIPELINE_ERROR} ${errorMessage}`,
      errorCode: 'PIPELINE_ERROR'
    };
  }

  // Step 4: Return result
  if (pipelineResult.success) {
    console.log(`[ToolGenerator] Success! Tool: "${pipelineResult.toolName}", Score: ${pipelineResult.qaReport?.score}`);
    return {
      success: true,
      toolName: pipelineResult.toolName,
      toolSlug: pipelineResult.toolSlug,
      toolHtml: pipelineResult.toolHtml,
      toolDescription: pipelineResult.toolDescription,
      category: pipelineResult.category,
      qaScore: pipelineResult.qaReport?.score,
      qaReport: pipelineResult.qaReport ? {
        score: pipelineResult.qaReport.score,
        result: pipelineResult.qaReport.result,
        issues: pipelineResult.qaReport.issues,
        recommendations: pipelineResult.qaReport.recommendations
      } : undefined,
      revisionCount: pipelineResult.revisionCount
    };
  } else {
    console.log(`[ToolGenerator] Failed: ${pipelineResult.error}`);
    return {
      success: false,
      toolName: pipelineResult.toolName,
      toolSlug: pipelineResult.toolSlug,
      toolHtml: pipelineResult.toolHtml,  // Return last attempt for review
      category: pipelineResult.category,
      qaScore: pipelineResult.qaReport?.score,
      qaReport: pipelineResult.qaReport ? {
        score: pipelineResult.qaReport.score,
        result: pipelineResult.qaReport.result,
        issues: pipelineResult.qaReport.issues,
        recommendations: pipelineResult.qaReport.recommendations
      } : undefined,
      revisionCount: pipelineResult.revisionCount,
      error: pipelineResult.error || ERROR_MESSAGES.QA_FAILED,
      errorCode: 'QA_FAILED'
    };
  }
}

// ========== TEXT EXTRACTION ==========

/**
 * Extract text content from file buffer based on file type
 */
async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  const type = fileType.toUpperCase();

  switch (type) {
    case 'TXT':
    case 'MD':
      // Plain text files - direct conversion
      return buffer.toString('utf-8');

    case 'PDF':
      // PDF extraction (requires pdf-parse or similar)
      return await extractPdfText(buffer);

    case 'DOCX':
      // DOCX extraction (requires mammoth or similar)
      return await extractDocxText(buffer);

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Extract text from PDF buffer
 * TODO: Implement with pdf-parse package
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // Try to load pdf-parse dynamically
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    // If pdf-parse not available, return placeholder
    console.warn('[ToolGenerator] pdf-parse not available, using fallback');
    return `[PDF Content - ${buffer.length} bytes]\n\nPlease install pdf-parse for PDF text extraction.`;
  }
}

/**
 * Extract text from DOCX buffer
 * TODO: Implement with mammoth package
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  // Try to load mammoth dynamically
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    // If mammoth not available, return placeholder
    console.warn('[ToolGenerator] mammoth not available, using fallback');
    return `[DOCX Content - ${buffer.length} bytes]\n\nPlease install mammoth for DOCX text extraction.`;
  }
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Get user-friendly error message
 */
export function getErrorMessage(code: GenerateErrorCode): string {
  return ERROR_MESSAGES[code];
}

/**
 * Check if the generator is ready to use
 */
export function isGeneratorReady(): { ready: boolean; missing: string[] } {
  const configCheck = checkAIConfiguration();
  return {
    ready: configCheck.valid,
    missing: configCheck.missing
  };
}
