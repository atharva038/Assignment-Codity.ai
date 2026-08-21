/**
 * ============================================================================
 * Retry Backoff Calculator — Distributed Job Scheduler
 * ============================================================================
 * Calculates exact delay in milliseconds before retrying a failed job based
 * on its assigned queue RetryPolicy (FIXED, LINEAR, or EXPONENTIAL).
 */

import { RetryPolicyType } from '../enums/index.js';

export interface BackoffOptions {
  policyType: RetryPolicyType;
  attemptNumber: number; // 1-indexed attempt number just failed
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier?: number;
  addJitter?: boolean;
}

/**
 * Computes retry delay in milliseconds for a given failure attempt.
 * 
 * Formulae:
 * - FIXED:       delay = initialDelay
 * - LINEAR:      delay = initialDelay * attemptNumber
 * - EXPONENTIAL: delay = initialDelay * (multiplier ^ (attemptNumber - 1))
 * 
 * Jitter: Adds random variance (+/- 10%) to prevent thundering herd problem
 * when multiple jobs fail simultaneously.
 */
export function calculateRetryDelay(options: BackoffOptions): number {
  const {
    policyType,
    attemptNumber,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier = 2,
    addJitter = true,
  } = options;

  let calculatedDelay = initialDelayMs;

  switch (policyType) {
    case RetryPolicyType.FIXED:
      calculatedDelay = initialDelayMs;
      break;

    case RetryPolicyType.LINEAR:
      calculatedDelay = initialDelayMs * attemptNumber;
      break;

    case RetryPolicyType.EXPONENTIAL:
      // Exponential power scaling: e.g. 1000 * (2 ^ 0) = 1000, 1000 * (2 ^ 1) = 2000, 1000 * (2 ^ 2) = 4000
      calculatedDelay = initialDelayMs * Math.pow(backoffMultiplier, Math.max(0, attemptNumber - 1));
      break;

    default:
      calculatedDelay = initialDelayMs;
  }

  // Cap at maximum configured delay safeguard
  calculatedDelay = Math.min(calculatedDelay, maxDelayMs);

  // Apply randomized jitter if enabled (+/- 10% variation)
  if (addJitter) {
    const jitterFactor = 0.9 + Math.random() * 0.2; // 0.90 to 1.10
    calculatedDelay = Math.floor(calculatedDelay * jitterFactor);
  }

  return Math.max(0, calculatedDelay);
}
