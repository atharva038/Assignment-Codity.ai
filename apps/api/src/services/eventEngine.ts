/**
 * ============================================================================
 * Event Ingestion & Dispatching Engine — Distributed Job Scheduler
 * ============================================================================
 * Central processor for Event-Driven Execution.
 * Evaluates incoming events against active EventSubscriptions, validates HMAC
 * signatures for webhooks, dynamically interpolates JSON payloads, and
 * transactionally enqueues single Jobs or multi-node DAG Workflows.
 */

import crypto from 'crypto';
import { prisma, JobStatus, WorkflowStatus, EventDeliveryStatus } from '@job-scheduler/database';
import {
  interpolatePayload,
  matchEventPattern,
  validateWorkflowDag,
  DagEdge,
} from '@job-scheduler/shared';
import { logger } from '@job-scheduler/logger';
import { emitStatsSnapshot } from '../ws/statsEmitter.js';

export interface DispatchEventOptions {
  projectId: string;
  eventType: string;
  payload: Record<string, any>;
  idempotencyKey?: string;
  source?: string;
  subscriptionId?: string; // If targeting a specific inbound webhook endpoint
  signatureHeader?: string; // Optional HMAC signature from header
  rawBodyString?: string;   // Raw body string for HMAC calculation
}

export interface DispatchEventResult {
  eventLogId: string;
  status: 'PROCESSED' | 'IGNORED' | 'FAILED';
  matchedRuleCount: number;
  triggeredJobIds: string[];
  triggeredWorkflowIds: string[];
  errorReason?: string;
  signatureVerified: boolean;
}

/**
 * Validates HMAC SHA-256 signature for incoming webhooks.
 */
export function verifyHmacSignature(rawBody: string, secret: string, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;

  // Clean signature (support "sha256=abcdef..." or raw hex "abcdef...")
  const cleanSig = signatureHeader.replace(/^sha256=/, '').trim();

  const computedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSig, 'utf-8'),
      Buffer.from(computedSig, 'utf-8')
    );
  } catch {
    return false;
  }
}

export class EventEngine {
  /**
   * Ingests and dispatches an event to matching subscriptions.
   */
  static async dispatchEvent(options: DispatchEventOptions): Promise<DispatchEventResult> {
    const {
      projectId,
      eventType,
      payload,
      idempotencyKey,
      source = 'API',
      subscriptionId,
      signatureHeader,
      rawBodyString,
    } = options;

    logger.info({ projectId, eventType, source, idempotencyKey }, 'EventEngine: Ingesting event');

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existingLog = await prisma.eventLog.findUnique({
        where: {
          projectId_idempotencyKey: {
            projectId,
            idempotencyKey,
          },
        },
      });

      if (existingLog) {
        logger.info(
          { eventLogId: existingLog.id, idempotencyKey },
          'EventEngine: Duplicate event skipped via idempotencyKey'
        );
        return {
          eventLogId: existingLog.id,
          status: existingLog.status as any,
          matchedRuleCount: existingLog.matchedRuleCount,
          triggeredJobIds: (existingLog.triggeredJobIds as string[]) || [],
          triggeredWorkflowIds: (existingLog.triggeredWorkflowIds as string[]) || [],
          signatureVerified: existingLog.signatureVerified,
        };
      }
    }

    // 2. Query Candidate Subscriptions
    let candidateSubscriptions;
    if (subscriptionId) {
      const sub = await prisma.eventSubscription.findUnique({
        where: { id: subscriptionId },
      });
      candidateSubscriptions = sub && sub.projectId === projectId && sub.enabled ? [sub] : [];
    } else {
      candidateSubscriptions = await prisma.eventSubscription.findMany({
        where: {
          projectId,
          enabled: true,
        },
      });
    }

    // Filter matching subscriptions by event pattern (e.g. "payment.*" or "*")
    const matchingSubscriptions = candidateSubscriptions.filter((sub) =>
      matchEventPattern(sub.eventType, eventType)
    );

    let signatureVerified = false;

    // 3. Handle No Matching Rules
    if (matchingSubscriptions.length === 0) {
      const eventLog = await prisma.eventLog.create({
        data: {
          projectId,
          eventType,
          source,
          payload: payload || {},
          idempotencyKey,
          status: EventDeliveryStatus.IGNORED,
          matchedRuleCount: 0,
          triggeredJobIds: [],
          triggeredWorkflowIds: [],
          signatureVerified: false,
        },
      });

      return {
        eventLogId: eventLog.id,
        status: 'IGNORED',
        matchedRuleCount: 0,
        triggeredJobIds: [],
        triggeredWorkflowIds: [],
        signatureVerified: false,
      };
    }

    const triggeredJobIds: string[] = [];
    const triggeredWorkflowIds: string[] = [];

    // 4. Process Each Matching Subscription
    try {
      for (const sub of matchingSubscriptions) {
        // Webhook HMAC Verification: only enforced if source is WEBHOOK and sub has a secret
        if (source === 'WEBHOOK' && sub.secret) {
          if (!signatureHeader || !rawBodyString) {
            throw new Error(`HMAC signature verification failed: Missing signature header for subscription "${sub.name}"`);
          }
          const isValid = verifyHmacSignature(rawBodyString, sub.secret, signatureHeader);
          if (!isValid) {
            throw new Error(`HMAC signature mismatch for subscription "${sub.name}"`);
          }
          signatureVerified = true;
        }

        const interpolationContext = {
          event: payload,
          payload,
          eventType,
          subscriptionName: sub.name,
          timestamp: new Date().toISOString(),
        };

        if (sub.targetType === 'JOB') {
          if (!sub.queueId || !sub.jobType) {
            logger.warn({ subId: sub.id }, 'EventEngine: Subscription target is JOB but queueId or jobType is missing');
            continue;
          }

          // Interpolate dynamic payload template
          const resolvedPayload = sub.jobPayloadTemplate
            ? interpolatePayload(sub.jobPayloadTemplate, interpolationContext)
            : payload;

          const job = await prisma.job.create({
            data: {
              queueId: sub.queueId,
              type: sub.jobType,
              payload: resolvedPayload || {},
              status: JobStatus.QUEUED,
              priority: 10,
              availableAt: new Date(),
            },
          });

          triggeredJobIds.push(job.id);
          logger.info({ jobId: job.id, subId: sub.id }, 'EventEngine: Triggered Job successfully');
        } else if (sub.targetType === 'WORKFLOW') {
          const wfTemplate: any = sub.workflowTemplate;
          if (!wfTemplate || !Array.isArray(wfTemplate.nodes) || wfTemplate.nodes.length === 0) {
            logger.warn({ subId: sub.id }, 'EventEngine: Subscription target is WORKFLOW but workflowTemplate is missing');
            continue;
          }

          // Validate DAG Cycle Safety
          const nodeKeys = wfTemplate.nodes.map((n: any) => n.key);
          const edges: DagEdge[] = [];
          for (const node of wfTemplate.nodes) {
            if (node.parents && Array.isArray(node.parents)) {
              for (const parentKey of node.parents) {
                edges.push({ parent: parentKey, child: node.key });
              }
            }
          }

          const dagResult = validateWorkflowDag(nodeKeys, edges);
          if (!dagResult.isValid) {
            throw new Error(`Invalid Workflow DAG in subscription template: ${dagResult.error}`);
          }

          // Instantiate Workflow DAG Transactionally
          const createdWorkflow = await prisma.$transaction(async (tx) => {
            const workflow = await tx.workflow.create({
              data: {
                projectId,
                name: `${wfTemplate.name || 'Event Workflow'} [${eventType}]`,
                description: wfTemplate.description || `Triggered by event ${eventType}`,
                status: WorkflowStatus.RUNNING,
              },
            });

            const keyToJobMap = new Map<string, string>();
            const nodeMap = new Map(wfTemplate.nodes.map((n: any) => [n.key, n]));

            for (const key of dagResult.topologicalOrder!) {
              const nodeInput: any = nodeMap.get(key);
              const parentKeys: string[] = nodeInput.parents || [];
              const unresolvedParentCount = parentKeys.length;
              const initialStatus = unresolvedParentCount > 0 ? JobStatus.BLOCKED : JobStatus.QUEUED;

              const resolvedNodePayload = nodeInput.payload
                ? interpolatePayload(nodeInput.payload, interpolationContext)
                : payload;

              const job = await tx.job.create({
                data: {
                  queueId: nodeInput.queueId,
                  workflowId: workflow.id,
                  type: nodeInput.type,
                  payload: resolvedNodePayload,
                  priority: nodeInput.priority || 10,
                  status: initialStatus,
                  unresolvedParentCount,
                  availableAt: new Date(),
                },
              });

              keyToJobMap.set(key, job.id);
              triggeredJobIds.push(job.id);
            }

            // Insert JobDependency records
            for (const edge of edges) {
              const parentJobId = keyToJobMap.get(edge.parent);
              const childJobId = keyToJobMap.get(edge.child);
              if (parentJobId && childJobId) {
                await tx.jobDependency.create({
                  data: { parentJobId, childJobId },
                });
              }
            }

            return workflow;
          });

          triggeredWorkflowIds.push(createdWorkflow.id);
          logger.info({ workflowId: createdWorkflow.id, subId: sub.id }, 'EventEngine: Triggered Workflow DAG successfully');
        }
      }

      // 5. Create Success EventLog Record
      const eventLog = await prisma.eventLog.create({
        data: {
          projectId,
          eventType,
          source,
          payload: payload || {},
          idempotencyKey,
          status: EventDeliveryStatus.PROCESSED,
          matchedRuleCount: matchingSubscriptions.length,
          triggeredJobIds,
          triggeredWorkflowIds,
          signatureVerified,
        },
      });

      // Broadcast updated real-time stats to connected dashboard clients
      try {
        await emitStatsSnapshot();
      } catch (wsErr) {
        logger.warn({ wsErr }, 'EventEngine: Failed to broadcast WebSocket stats update');
      }

      return {
        eventLogId: eventLog.id,
        status: 'PROCESSED',
        matchedRuleCount: matchingSubscriptions.length,
        triggeredJobIds,
        triggeredWorkflowIds,
        signatureVerified,
      };
    } catch (err: any) {
      logger.error({ err, projectId, eventType }, 'EventEngine: Error processing event dispatch');

      const failedLog = await prisma.eventLog.create({
        data: {
          projectId,
          eventType,
          source,
          payload: payload || {},
          idempotencyKey,
          status: EventDeliveryStatus.FAILED,
          matchedRuleCount: matchingSubscriptions.length,
          triggeredJobIds,
          triggeredWorkflowIds,
          errorReason: err.message || 'Unknown processing error',
          signatureVerified,
        },
      });

      return {
        eventLogId: failedLog.id,
        status: 'FAILED',
        matchedRuleCount: matchingSubscriptions.length,
        triggeredJobIds,
        triggeredWorkflowIds,
        errorReason: err.message,
        signatureVerified,
      };
    }
  }
}
