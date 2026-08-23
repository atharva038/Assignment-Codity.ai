/**
 * ============================================================================
 * Workflow DAG Ingestion & Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Handles workflow creation with Kahn's Algorithm DAG cycle detection,
 * workflow state inspection with graph nodes & edges, and workflow cancellation.
 */

import { Router, Request, Response } from 'express';
import { prisma, JobStatus, WorkflowStatus, LogLevel } from '@job-scheduler/database';
import {
  CreateWorkflowSchema,
  WorkflowQuerySchema,
  validateWorkflowDag,
  DagEdge,
} from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitStatsSnapshot } from '../ws/statsEmitter.js';
import { getActiveOrgId } from '../middleware/tenant.js';

export const workflowsRouter = Router();

workflowsRouter.use(authenticateToken);

/**
 * POST /api/v1/workflows
 * Ingests a new multi-job Workflow DAG pipeline.
 * Validates DAG cycle safety via Kahn's algorithm before insertion.
 */
workflowsRouter.post('/', validate(CreateWorkflowSchema), async (req: Request, res: Response) => {
  const { projectId, name, description, nodes } = req.body;

  // 1. Verify target Project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Target Project does not exist' });
    return;
  }

  // 2. Build graph node keys and directed edges
  const nodeKeys = nodes.map((n: any) => n.key);
  const edges: DagEdge[] = [];

  for (const node of nodes) {
    if (node.parents && Array.isArray(node.parents)) {
      for (const parentKey of node.parents) {
        edges.push({ parent: parentKey, child: node.key });
      }
    }
  }

  // 3. Validate DAG using Kahn's Algorithm (topological sort & cycle detection)
  const dagResult = validateWorkflowDag(nodeKeys, edges);
  if (!dagResult.isValid) {
    res.status(400).json({
      error: 'Invalid Workflow DAG',
      message: dagResult.error,
    });
    return;
  }

  // 4. Perform transactional creation of Workflow, Jobs, and JobDependencies
  const createdWorkflow = await prisma.$transaction(async (tx) => {
    // Create Workflow container row
    const workflow = await tx.workflow.create({
      data: {
        projectId,
        name,
        description,
        status: WorkflowStatus.RUNNING,
      },
    });

    const keyToJobMap = new Map<string, string>();
    const createdJobs = [];

    // Create Jobs in topological order
    const nodeMap = new Map(nodes.map((n: any) => [n.key, n]));

    for (const key of dagResult.topologicalOrder!) {
      const nodeInput: any = nodeMap.get(key);
      const parentKeys: string[] = nodeInput.parents || [];
      const unresolvedParentCount = parentKeys.length;
      const initialStatus = unresolvedParentCount > 0 ? JobStatus.BLOCKED : JobStatus.QUEUED;

      const job = await tx.job.create({
        data: {
          queueId: nodeInput.queueId,
          workflowId: workflow.id,
          type: nodeInput.type,
          payload: nodeInput.payload || {},
          priority: nodeInput.priority || 10,
          maxAttempts: nodeInput.maxAttempts || 3,
          timeoutMs: nodeInput.timeoutMs || 30000,
          status: initialStatus,
          unresolvedParentCount,
          availableAt: new Date(),
        },
      });

      keyToJobMap.set(key, job.id);
      createdJobs.push({ key, job });

      // Create log entry
      await tx.jobLog.create({
        data: {
          jobId: job.id,
          level: LogLevel.INFO,
          message:
            initialStatus === JobStatus.BLOCKED
              ? `Workflow node created in BLOCKED status waiting on ${unresolvedParentCount} parent dependencies (${parentKeys.join(', ')})`
              : `Workflow root node created in QUEUED status ready for execution.`,
          metadata: { workflowId: workflow.id, key, parents: parentKeys },
        },
      });
    }

    // Insert JobDependency edge records
    for (const edge of edges) {
      const parentJobId = keyToJobMap.get(edge.parent)!;
      const childJobId = keyToJobMap.get(edge.child)!;

      await tx.jobDependency.create({
        data: {
          parentJobId,
          childJobId,
        },
      });
    }

    return {
      workflow,
      createdJobs,
    };
  });

  emitStatsSnapshot().catch(() => {});

  res.status(201).json({
    message: 'Workflow created and initialized successfully',
    workflow: createdWorkflow.workflow,
    nodes: createdWorkflow.createdJobs,
    topologicalOrder: dagResult.topologicalOrder,
  });
});

/**
 * GET /api/v1/workflows
 * Lists workflows with pagination, optional project filter, and status filter.
 */
workflowsRouter.get('/', validate(WorkflowQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { projectId, status, page = 1, limit = 10 } = req.query as any;
  const activeOrgId = getActiveOrgId(req);

  const where: any = {};
  if (projectId) {
    where.projectId = projectId;
  } else if (activeOrgId) {
    where.project = { organizationId: activeOrgId };
  }

  if (status) where.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [workflows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        jobs: {
          select: { id: true, status: true },
        },
      },
    }),
    prisma.workflow.count({ where }),
  ]);

  const formattedWorkflows = workflows.map((wf) => {
    const totalJobs = wf.jobs.length;
    const completedJobs = wf.jobs.filter((j) => j.status === JobStatus.COMPLETED).length;
    const failedJobs = wf.jobs.filter(
      (j) => j.status === JobStatus.DEAD || j.status === JobStatus.FAILED || j.status === JobStatus.CANCELLED
    ).length;
    const runningJobs = wf.jobs.filter(
      (j) => j.status === JobStatus.RUNNING || j.status === JobStatus.CLAIMED
    ).length;
    const blockedJobs = wf.jobs.filter((j) => j.status === JobStatus.BLOCKED).length;
    const queuedJobs = wf.jobs.filter((j) => j.status === JobStatus.QUEUED).length;

    let computedStatus = wf.status;
    if (failedJobs > 0) {
      computedStatus = WorkflowStatus.FAILED;
    } else if (completedJobs === totalJobs && totalJobs > 0) {
      computedStatus = WorkflowStatus.COMPLETED;
    } else if (runningJobs > 0 || queuedJobs > 0) {
      computedStatus = WorkflowStatus.RUNNING;
    }

    return {
      id: wf.id,
      projectId: wf.projectId,
      projectName: wf.project.name,
      name: wf.name,
      description: wf.description,
      status: computedStatus,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      stats: {
        totalJobs,
        completedJobs,
        failedJobs,
        runningJobs,
        blockedJobs,
        queuedJobs,
        progressPercentage: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      },
    };
  });

  res.status(200).json({
    workflows: formattedWorkflows,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

/**
 * GET /api/v1/workflows/:id
 * Retrieves full workflow details, including full job nodes & dependency edges for visualization.
 */
workflowsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      jobs: {
        include: {
          queue: { select: { id: true, name: true } },
          parentDependencies: {
            select: { parentJobId: true },
          },
          childDependencies: {
            select: { childJobId: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!workflow) {
    res.status(404).json({ error: 'Not Found', message: 'Workflow not found' });
    return;
  }

  // Format node & edge objects for UI rendering
  const nodes = workflow.jobs.map((job) => ({
    id: job.id,
    type: job.type,
    status: job.status,
    queueName: job.queue.name,
    priority: job.priority,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    unresolvedParentCount: job.unresolvedParentCount,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    errorReason: job.errorReason,
    parentJobIds: job.parentDependencies.map((p) => p.parentJobId),
    childJobIds: job.childDependencies.map((c) => c.childJobId),
  }));

  const edges: DagEdge[] = [];
  for (const job of workflow.jobs) {
    for (const dep of job.childDependencies) {
      edges.push({
        parent: job.id,
        child: dep.childJobId,
      });
    }
  }

  const totalJobs = nodes.length;
  const completedJobs = nodes.filter((n) => n.status === JobStatus.COMPLETED).length;

  res.status(200).json({
    workflow: {
      id: workflow.id,
      projectId: workflow.projectId,
      projectName: workflow.project.name,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      progressPercentage: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
    },
    nodes,
    edges,
  });
});

/**
 * POST /api/v1/workflows/:id/cancel
 * Cancels active workflow and all pending/blocked jobs in it.
 */
workflowsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;

  const workflow = await prisma.workflow.findUnique({
    where: { id },
    include: { jobs: true },
  });

  if (!workflow) {
    res.status(404).json({ error: 'Not Found', message: 'Workflow not found' });
    return;
  }

  await prisma.$transaction([
    prisma.workflow.update({
      where: { id },
      data: { status: WorkflowStatus.CANCELLED },
    }),
    prisma.job.updateMany({
      where: {
        workflowId: id,
        status: { in: [JobStatus.BLOCKED, JobStatus.QUEUED, JobStatus.SCHEDULED] },
      },
      data: {
        status: JobStatus.CANCELLED,
        failedAt: new Date(),
        errorReason: 'Workflow manually cancelled by user',
      },
    }),
  ]);

  emitStatsSnapshot().catch(() => {});

  res.status(200).json({
    message: 'Workflow and all non-completed jobs cancelled successfully',
  });
});
