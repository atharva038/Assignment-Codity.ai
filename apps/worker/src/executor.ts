/**
 * ============================================================================
 * Job Execution Engine & Logger — Distributed Job Scheduler
 * ============================================================================
 * Executes claimed jobs using pluggable handler functions, tracks attempt history
 * in `JobExecution`, writes microsecond execution logs in `JobLog`, calculates retry
 * backoff delays on failure, and routes exhausted jobs to the Dead Letter Queue (DLQ).
 */

import { prisma, Job, JobStatus, ExecutionStatus, LogLevel, DLQResolutionStatus } from '@job-scheduler/database';
import { calculateRetryDelay, RetryPolicyType } from '@job-scheduler/shared';
import { logger } from '@job-scheduler/logger';
import { publishJobEvent } from '@job-scheduler/redis';
import { getJobHandler } from './handlers/registry.js';
import { onJobCompleted, onJobFailedOrCancelled } from './dependencyEngine.js';

export async function executeJob(job: Job & { queue?: any }, workerId: string): Promise<void> {
  const startTime = Date.now();
  const attemptNumber = job.attempts;

  logger.info({ jobId: job.id, type: job.type, attemptNumber, workerId }, '🚀 Execution started for job');

  // Broadcast Real-time Event: Job Running
  publishJobEvent({
    type: 'job:updated',
    payload: { jobId: job.id, status: JobStatus.RUNNING, workerId },
    ts: Date.now(),
  }).catch(() => {});

  // 1. Create JobExecution record for this attempt
  const execution = await prisma.jobExecution.create({
    data: {
      jobId: job.id,
      workerId,
      attemptNumber,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(startTime),
    },
  });

  // 2. Write initial execution start log
  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      executionId: execution.id,
      workerId,
      level: LogLevel.INFO,
      message: `Job execution attempt #${attemptNumber} started on worker ${workerId}`,
      metadata: { type: job.type, priority: job.priority },
    },
  });

  try {
    // 3. Resolve execution handler
    const handler = getJobHandler(job.type);

    // Execute handler with timeout safety wrapper
    const timeoutMs = job.timeoutMs || 30000;
    const result = await Promise.race([
      handler(job.payload as Record<string, unknown>),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Job execution timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    const durationMs = Date.now() - startTime;

    // 4. Update JobExecution as COMPLETED
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: ExecutionStatus.COMPLETED,
        completedAt: new Date(),
        durationMs,
        result: (result as any) || {},
      },
    });

    // 5. Update Job status as COMPLETED
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        lockedUntil: null,
      },
    });

    // 6. Write success log
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        executionId: execution.id,
        workerId,
        level: LogLevel.INFO,
        message: `Job completed successfully in ${durationMs}ms`,
        metadata: (result as any) || {},
      },
    });

    logger.info({ jobId: job.id, durationMs }, '✅ Job execution completed successfully');

    // Broadcast Real-time Event: Job Completed
    publishJobEvent({
      type: 'job:updated',
      payload: { jobId: job.id, status: JobStatus.COMPLETED, durationMs },
      ts: Date.now(),
    }).catch(() => {});

    // Evaluate DAG child dependency resolution
    await onJobCompleted(job.id);
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorReason = err?.message || 'Unknown execution error';
    const stackTrace = err?.stack || null;
    const isTimeout = errorReason.includes('timed out');

    logger.error({ jobId: job.id, attemptNumber, errorReason }, '❌ Job execution failed');

    // Update JobExecution as FAILED or TIMED_OUT
    await prisma.jobExecution.update({
      where: { id: execution.id },
      data: {
        status: isTimeout ? ExecutionStatus.TIMED_OUT : ExecutionStatus.FAILED,
        completedAt: new Date(),
        durationMs,
        errorReason,
        stackTrace,
      },
    });

    // Write error log
    await prisma.jobLog.create({
      data: {
        jobId: job.id,
        executionId: execution.id,
        workerId,
        level: LogLevel.ERROR,
        message: `Execution attempt #${attemptNumber} failed: ${errorReason}`,
        metadata: { stackTrace },
      },
    });

    // Evaluate Retry Eligibility
    if (attemptNumber < job.maxAttempts) {
      // Calculate retry backoff delay
      const retryPolicy = job.queue?.retryPolicy;
      const policyType = (retryPolicy?.type as RetryPolicyType) || RetryPolicyType.EXPONENTIAL;
      const initialDelayMs = retryPolicy?.initialDelayMs || 1000;
      const maxDelayMs = retryPolicy?.maxDelayMs || 60000;
      const backoffMultiplier = retryPolicy?.backoffMultiplier || 2.0;

      const delayMs = calculateRetryDelay({
        policyType,
        attemptNumber,
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        addJitter: true,
      });

      const nextAvailableAt = new Date(Date.now() + delayMs);

      // Re-queue job for future execution timestamp
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.RETRYING,
          availableAt: nextAvailableAt,
          failedAt: new Date(),
          errorReason,
          lockedUntil: null,
        },
      });

      // Transition RETRYING -> QUEUED immediately or on next availability check
      await prisma.jobLog.create({
        data: {
          jobId: job.id,
          executionId: execution.id,
          workerId,
          level: LogLevel.WARN,
          message: `Job scheduled for retry attempt #${attemptNumber + 1} in ${delayMs}ms (at ${nextAvailableAt.toISOString()})`,
        },
      });

      logger.info({ jobId: job.id, delayMs, nextAvailableAt }, '🔄 Job scheduled for retry');

      publishJobEvent({
        type: 'job:updated',
        payload: { jobId: job.id, status: JobStatus.RETRYING, delayMs, nextAvailableAt },
        ts: Date.now(),
      }).catch(() => {});
    } else {
      // Max attempts exhausted: transition to DEAD and route to Dead Letter Queue (DLQ)
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.DEAD,
            failedAt: new Date(),
            errorReason,
            lockedUntil: null,
          },
        }),
        prisma.deadLetterJob.upsert({
          where: { originalJobId: job.id },
          update: {
            attempts: attemptNumber,
            finalErrorReason: errorReason,
            stackTrace,
            failedWorkerId: workerId,
            resolutionStatus: DLQResolutionStatus.PENDING,
          },
          create: {
            originalJobId: job.id,
            queueId: job.queueId,
            attempts: attemptNumber,
            finalErrorReason: errorReason,
            stackTrace,
            failedWorkerId: workerId,
            resolutionStatus: DLQResolutionStatus.PENDING,
          },
        }),
        prisma.jobLog.create({
          data: {
            jobId: job.id,
            executionId: execution.id,
            workerId,
            level: LogLevel.ERROR,
            message: `Max attempts (${job.maxAttempts}) exhausted. Job moved to Dead Letter Queue (DLQ).`,
          },
        }),
      ]);

      logger.error({ jobId: job.id, attempts: attemptNumber }, '☠️ Job attempts exhausted. Routed to DLQ');

      // Trigger cascading cancellation for downstream child DAG dependencies
      await onJobFailedOrCancelled(job.id, errorReason);
    }
  }
}
