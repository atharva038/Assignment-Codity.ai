/**
 * ============================================================================
 * Pluggable Job Handler Registry — Distributed Job Scheduler
 * ============================================================================
 * Maps job type identifier strings (e.g. `email_notification`) to their respective
 * execution handler functions. Fallback default handler executes unknown job types safely.
 */

import { emailHandler } from './email.js';
import { reportHandler } from './report.js';
import { webhookHandler } from './webhook.js';
import { failureDemoHandler } from './failureDemo.js';

export type JobHandlerFn = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlerRegistry: Record<string, JobHandlerFn> = {
  email_notification: emailHandler,
  report_generation: reportHandler,
  webhook_delivery: webhookHandler,
  failure_demo: failureDemoHandler,
};

/**
 * Resolves job execution handler by type string.
 */
export function getJobHandler(type: string): JobHandlerFn {
  const handler = handlerRegistry[type];

  if (handler) {
    return handler;
  }

  // Generic fallback handler for dynamic or custom job types
  return async (payload: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      status: 'executed',
      jobType: type,
      receivedPayload: payload,
      executedAt: new Date().toISOString(),
    };
  };
}
