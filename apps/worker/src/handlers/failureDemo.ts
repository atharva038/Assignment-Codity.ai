/**
 * ============================================================================
 * Failure Demo Job Handler — Distributed Job Scheduler
 * ============================================================================
 * Intentionally throws an error to test job failure handling, exponential retry
 * backoff calculations, and Dead Letter Queue (DLQ) routing.
 */

export async function failureDemoHandler(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const errorMessage = (payload.errorMessage as string) || 'Simulated fatal processing error in job execution handler';
  
  // Simulate brief processing before failure
  await new Promise((resolve) => setTimeout(resolve, 50));

  throw new Error(errorMessage);
}
