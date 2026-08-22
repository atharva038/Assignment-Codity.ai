/**
 * ============================================================================
 * Workflow Dependency Resolution Engine — Distributed Job Scheduler
 * ============================================================================
 * Handles automatic DAG dependency resolution when parent jobs complete,
 * promotes BLOCKED child jobs to QUEUED state when all parents finish,
 * and handles cascading cancellation when upstream parents fail.
 */

import { prisma, JobStatus, WorkflowStatus, LogLevel } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';
import { publishJobEvent } from '@job-scheduler/redis';

/**
 * Triggered when a job transitions to COMPLETED.
 * Evaluates child dependencies and promotes BLOCKED jobs whose parent prerequisites are satisfied.
 */
export async function onJobCompleted(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, workflowId: true, type: true },
  });

  if (!job || !job.workflowId) {
    return;
  }

  const workflowId = job.workflowId;

  // 1. Fetch all child dependencies that depend on this completed job
  const childDeps = await prisma.jobDependency.findMany({
    where: { parentJobId: jobId },
    include: {
      childJob: {
        include: {
          parentDependencies: {
            include: {
              parentJob: {
                select: { id: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  for (const dep of childDeps) {
    const child = dep.childJob;
    if (child.status !== JobStatus.BLOCKED) {
      continue;
    }

    // Atomically decrement unresolvedParentCount
    const updatedChild = await prisma.job.update({
      where: { id: child.id },
      data: { unresolvedParentCount: { decrement: 1 } },
      select: { id: true, unresolvedParentCount: true, status: true },
    });

    // Check if ALL parent dependencies are COMPLETED
    const allParentsCompleted = child.parentDependencies.every(
      (p) => p.parentJobId === jobId || p.parentJob.status === JobStatus.COMPLETED
    );

    if (updatedChild.unresolvedParentCount <= 0 && allParentsCompleted) {
      // Promote BLOCKED -> QUEUED
      await prisma.job.update({
        where: { id: child.id },
        data: {
          status: JobStatus.QUEUED,
          availableAt: new Date(),
        },
      });

      await prisma.jobLog.create({
        data: {
          jobId: child.id,
          level: LogLevel.INFO,
          message: `All parent DAG dependencies resolved. Promoted status from BLOCKED to QUEUED.`,
          metadata: { resolvedByParentId: jobId },
        },
      });

      logger.info(
        { childJobId: child.id, workflowId, parentJobId: jobId },
        '🔓 Child job dependencies satisfied. Promoted BLOCKED -> QUEUED'
      );

      // Publish Redis Pub/Sub event for WebSocket live UI updates
      try {
        await publishJobEvent({
          event: 'JOB_STATUS_CHANGED',
          jobId: child.id,
          status: JobStatus.QUEUED,
          workflowId,
        });
      } catch (err) {
        // Non-blocking pubsub error
      }
    }
  }

  // 2. Check and update overall Workflow status
  await updateWorkflowStatus(workflowId);
}

/**
 * Triggered when a parent job fails permanently (DEAD) or is CANCELLED.
 * Recursively cancels downstream child jobs that depend on the failed parent.
 */
export async function onJobFailedOrCancelled(jobId: string, reason: string): Promise<void> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, workflowId: true, status: true },
  });

  if (!job || !job.workflowId) {
    return;
  }

  const workflowId = job.workflowId;

  // Recursively find and cancel all downstream dependent child jobs
  const visited = new Set<string>();
  const queue = [jobId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (visited.has(parentId)) continue;
    visited.add(parentId);

    const childDeps = await prisma.jobDependency.findMany({
      where: { parentJobId: parentId },
      select: { childJobId: true },
    });

    for (const dep of childDeps) {
      const childId = dep.childJobId;
      const childJob = await prisma.job.findUnique({
        where: { id: childId },
        select: { id: true, status: true },
      });

      if (childJob && (childJob.status === JobStatus.BLOCKED || childJob.status === JobStatus.QUEUED)) {
        await prisma.job.update({
          where: { id: childId },
          data: {
            status: JobStatus.CANCELLED,
            failedAt: new Date(),
            errorReason: `Cascading failure: parent job ${parentId} failed/cancelled (${reason})`,
          },
        });

        await prisma.jobLog.create({
          data: {
            jobId: childId,
            level: LogLevel.ERROR,
            message: `Job cancelled due to upstream parent dependency failure (${parentId}).`,
            metadata: { failedParentId: parentId, reason },
          },
        });

        logger.warn(
          { childJobId: childId, workflowId, failedParentId: parentId },
          '🚫 Downstream child job cancelled due to parent failure'
        );

        queue.push(childId);
      }
    }
  }

  // Update Workflow status to FAILED
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: WorkflowStatus.FAILED },
  });
}

/**
 * Re-calculates and updates the aggregate Workflow state based on member jobs.
 */
export async function updateWorkflowStatus(workflowId: string): Promise<void> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      jobs: {
        select: { id: true, status: true },
      },
    },
  });

  if (!workflow || workflow.jobs.length === 0) return;

  const total = workflow.jobs.length;
  const completedCount = workflow.jobs.filter((j) => j.status === JobStatus.COMPLETED).length;
  const failedCount = workflow.jobs.filter(
    (j) => j.status === JobStatus.DEAD || j.status === JobStatus.FAILED || j.status === JobStatus.CANCELLED
  ).length;
  const runningOrClaimed = workflow.jobs.some(
    (j) => j.status === JobStatus.RUNNING || j.status === JobStatus.CLAIMED || j.status === JobStatus.QUEUED
  );

  let newStatus: WorkflowStatus = workflow.status;

  if (failedCount > 0) {
    newStatus = WorkflowStatus.FAILED;
  } else if (completedCount === total) {
    newStatus = WorkflowStatus.COMPLETED;
  } else if (runningOrClaimed) {
    newStatus = WorkflowStatus.RUNNING;
  }

  if (newStatus !== workflow.status) {
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { status: newStatus },
    });
    logger.info({ workflowId, oldStatus: workflow.status, newStatus }, '📊 Workflow status updated');
  }
}
