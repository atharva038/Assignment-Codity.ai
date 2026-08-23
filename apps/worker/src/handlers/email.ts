/**
 * ============================================================================
 * Email Notification Job Handler — Distributed Job Scheduler
 * ============================================================================
 * Handles `email_notification` jobs by simulating email delivery and payload validation.
 */

export async function emailHandler(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { to, subject, template } = payload;

  if (!to || typeof to !== 'string') {
    throw new Error('Invalid email payload: missing or invalid "to" recipient field');
  }

  // Simulate network dispatch delay (custom executionDelayMs or 100-200ms default)
  const delay = typeof payload.executionDelayMs === 'number' ? payload.executionDelayMs : 100 + Math.random() * 100;
  await new Promise((resolve) => setTimeout(resolve, delay));

  return {
    delivered: true,
    recipient: to,
    subject: subject || 'No Subject',
    template: template || 'default',
    messageId: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
  };
}
