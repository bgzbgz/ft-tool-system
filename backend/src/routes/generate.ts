/**
 * Fast Track Tool Generation Routes
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * New route that replaces n8n webhook + callback flow
 * Uses in-house AI pipeline for tool generation
 */

import { Router, Request, Response } from 'express';
import { getJob, updateJob } from '../services/jobStore';
import { generateTool, isGeneratorReady } from '../services/toolGenerator';
import { transitionJob, ActorType } from '../services/stateMachine';
import { JobStatus } from '../models/job';
import { PipelineProgress } from '../services/ai';

const router = Router();

// ========== ROUTES ==========

/**
 * POST /api/jobs/:id/generate
 *
 * Start tool generation for a job.
 * Returns immediately with 202 Accepted, streams progress via SSE.
 *
 * For SSE progress updates, use GET /api/jobs/:id/generate/stream
 */
router.post('/:id/generate', async (req: Request, res: Response) => {
  const jobId = req.params.id;

  // Get job
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      job_id: jobId
    });
  }

  // Validate job status (must be DRAFT to start generation)
  if (job.status !== JobStatus.DRAFT) {
    return res.status(409).json({
      error: `Cannot generate tool. Job status is ${job.status}, expected DRAFT`,
      job_id: jobId,
      current_status: job.status
    });
  }

  // Check AI configuration
  const readyCheck = isGeneratorReady();
  if (!readyCheck.ready) {
    return res.status(503).json({
      error: 'AI providers not configured',
      missing: readyCheck.missing
    });
  }

  // Transition to PROCESSING status
  const transitionResult = await transitionJob(
    job,
    JobStatus.SENT,  // Using SENT as PROCESSING equivalent
    ActorType.SYSTEM
  );

  if (!transitionResult.success) {
    return res.status(500).json({
      error: 'Failed to update job status',
      details: transitionResult.error
    });
  }

  // Update job in store
  updateJob(transitionResult.job!);

  // Return 202 Accepted - generation will happen asynchronously
  // Client should poll GET /api/jobs/:id or use SSE stream
  res.status(202).json({
    message: 'Tool generation started',
    job_id: jobId,
    status: JobStatus.SENT,
    stream_url: `/api/jobs/${jobId}/generate/stream`
  });

  // Start generation in background
  generateToolAsync(jobId);
});

/**
 * GET /api/jobs/:id/generate/stream
 *
 * Server-Sent Events endpoint for real-time progress updates
 */
router.get('/:id/generate/stream', async (req: Request, res: Response) => {
  const jobId = req.params.id;

  // Get job
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      job_id: jobId
    });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering

  // Helper to send SSE event
  const sendEvent = (event: string, data: object) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Check if already completed
  if (job.status === JobStatus.READY_FOR_REVIEW) {
    sendEvent('complete', {
      job_id: jobId,
      status: 'complete',
      tool_name: job.tool_id,
      qa_status: job.qa_status
    });
    res.end();
    return;
  }

  if (job.status === JobStatus.FACTORY_FAILED) {
    sendEvent('failed', {
      job_id: jobId,
      status: 'failed',
      error: job.failure_reason || 'Tool generation failed'
    });
    res.end();
    return;
  }

  // If not in progress, start generation
  if (job.status === JobStatus.DRAFT) {
    // Transition to SENT/PROCESSING
    const transitionResult = await transitionJob(
      job,
      JobStatus.SENT,
      ActorType.SYSTEM
    );

    if (transitionResult.success) {
      updateJob(transitionResult.job!);
    }
  }

  // Send initial event
  sendEvent('connected', {
    job_id: jobId,
    status: 'connected',
    message: 'Streaming tool generation progress...'
  });

  // Progress callback for SSE
  const onProgress = (progress: PipelineProgress) => {
    sendEvent('progress', {
      job_id: jobId,
      ...progress
    });
  };

  // Run generation with progress updates
  try {
    const result = await generateTool(job, onProgress);

    // Update job with result
    const updatedJob = {
      ...job,
      tool_id: result.toolSlug,
      tool_html: result.toolHtml,
      qa_status: result.success ? 'PASS' as const : 'FAIL' as const,
      qa_report: result.qaReport,
      revision_count: result.revisionCount,
      callback_received_at: new Date()
    };

    // Transition to final status
    const finalStatus = result.success ? JobStatus.READY_FOR_REVIEW : JobStatus.FACTORY_FAILED;
    const finalTransition = await transitionJob(updatedJob, finalStatus, ActorType.SYSTEM);

    if (finalTransition.success) {
      updateJob(finalTransition.job!);
    }

    // Send final event
    if (result.success) {
      sendEvent('complete', {
        job_id: jobId,
        status: 'complete',
        success: true,
        tool_name: result.toolName,
        tool_slug: result.toolSlug,
        qa_score: result.qaScore,
        category: result.category,
        revision_count: result.revisionCount
      });
    } else {
      sendEvent('failed', {
        job_id: jobId,
        status: 'failed',
        success: false,
        error: result.error,
        tool_name: result.toolName,
        qa_score: result.qaScore,
        revision_count: result.revisionCount
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    sendEvent('error', {
      job_id: jobId,
      status: 'error',
      error: errorMessage
    });
  }

  res.end();
});

/**
 * GET /api/generate/health
 *
 * Check if the AI generator is configured and ready
 */
router.get('/health', (req: Request, res: Response) => {
  const readyCheck = isGeneratorReady();

  if (readyCheck.ready) {
    res.json({
      status: 'ready',
      message: 'AI providers configured and ready'
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      message: 'AI providers not configured',
      missing: readyCheck.missing
    });
  }
});

// ========== HELPER FUNCTIONS ==========

/**
 * Run tool generation asynchronously (fire and forget)
 * Updates job status when complete
 */
async function generateToolAsync(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job) {
    console.error(`[Generate] Job ${jobId} not found for async generation`);
    return;
  }

  console.log(`[Generate] Starting async generation for job ${jobId}`);

  try {
    const result = await generateTool(job);

    // Update job with result
    const updatedJob = {
      ...job,
      tool_id: result.toolSlug,
      tool_html: result.toolHtml,
      qa_status: result.success ? 'PASS' as const : 'FAIL' as const,
      qa_report: result.qaReport,
      revision_count: result.revisionCount,
      callback_received_at: new Date(),
      failure_reason: result.success ? undefined : result.error
    };

    // Transition to final status
    const finalStatus = result.success ? JobStatus.READY_FOR_REVIEW : JobStatus.FACTORY_FAILED;
    const finalTransition = await transitionJob(updatedJob, finalStatus, ActorType.SYSTEM);

    if (finalTransition.success) {
      updateJob(finalTransition.job!);
      console.log(`[Generate] Job ${jobId} completed with status ${finalStatus}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Generate] Job ${jobId} failed:`, errorMessage);

    // Update job as failed
    const failedJob = {
      ...job,
      failure_reason: errorMessage
    };

    const failTransition = await transitionJob(failedJob, JobStatus.FACTORY_FAILED, ActorType.SYSTEM);
    if (failTransition.success) {
      updateJob(failTransition.job!);
    }
  }
}

export default router;
