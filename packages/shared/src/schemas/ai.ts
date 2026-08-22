import { z } from 'zod';

export interface AiDiagnosticResult {
  summary: string;
  suggestedFix: string;
  rootCauseCategory: 'NETWORK_TIMEOUT' | 'PAYLOAD_FORMAT' | 'DATABASE_CONSTRAINT' | 'CRASH_EXCEPTION' | 'RESOURCE_EXHAUSTED' | 'UNKNOWN';
  analyzedAt: string;
  source: 'OPENAI' | 'GEMINI' | 'HEURISTIC_ENGINE';
}

export const aiDiagnosticResponseSchema = z.object({
  summary: z.string(),
  suggestedFix: z.string(),
  rootCauseCategory: z.enum([
    'NETWORK_TIMEOUT',
    'PAYLOAD_FORMAT',
    'DATABASE_CONSTRAINT',
    'CRASH_EXCEPTION',
    'RESOURCE_EXHAUSTED',
    'UNKNOWN',
  ]),
  analyzedAt: z.string(),
  source: z.enum(['OPENAI', 'GEMINI', 'HEURISTIC_ENGINE']),
});
