/**
 * ============================================================================
 * AI Failure Summarizer Service — Distributed Job Scheduler
 * ============================================================================
 * Generates structured root-cause failure diagnostics and step-by-step
 * resolution recommendations for dead letter jobs (DLQ). Uses Google Gemini API
 * when available, with automatic fallback to a local rule-based heuristic engine.
 */

import { AiDiagnosticResult } from '@job-scheduler/shared';

interface FailureContext {
  jobType: string;
  payload: Record<string, unknown>;
  attempts: number;
  finalErrorReason?: string;
  stackTrace?: string;
  logs?: Array<{ level: string; message: string; timestamp: Date | string }>;
}

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

export async function analyzeJobFailure(context: FailureContext): Promise<AiDiagnosticResult> {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) dotenv.config({ path: p, override: true });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  console.log(`🤖 [AI Summarizer] Analyzing job '${context.jobType}'. Key Status -> OpenAI: ${openaiKey ? 'PRESENT (' + openaiKey.slice(0, 8) + '...)' : 'MISSING'}, Gemini: ${geminiKey ? 'PRESENT' : 'MISSING'}`);

  const prompt = `You are an expert distributed systems reliability engineer analyzing a dead letter job (DLQ) execution failure in a job scheduling engine.

JOB DETAILS:
- Job Type: ${context.jobType}
- Total Attempts Executed: ${context.attempts}
- Payload Attributes: ${JSON.stringify(context.payload, null, 2)}
- Error Reason: ${context.finalErrorReason || 'None recorded'}
- Stack Trace: ${context.stackTrace || 'No stack trace available'}
${context.logs && context.logs.length > 0 ? `- Execution Logs (Last ${context.logs.length}):\n${context.logs.map((l) => `  [${l.level}] ${l.message}`).join('\n')}` : ''}

INSTRUCTIONS:
Provide a structured diagnostic failure summary in strict JSON format matching this schema:
{
  "summary": "Concise 1-2 sentence root cause explanation of why this job failed.",
  "suggestedFix": "Detailed, step-by-step resolution advice to fix this error before replaying the job.",
  "rootCauseCategory": "NETWORK_TIMEOUT" | "PAYLOAD_FORMAT" | "DATABASE_CONSTRAINT" | "CRASH_EXCEPTION" | "RESOURCE_EXHAUSTED" | "UNKNOWN"
}
Return ONLY raw JSON, with no markdown code fences or conversational prose.`;

  // 1. OpenAI Chat Completions Integration
  if (openaiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an expert distributed systems reliability engineer. Output strictly valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data.choices?.[0]?.message?.content;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            summary: parsed.summary || 'Job execution failed after max retries.',
            suggestedFix: parsed.suggestedFix || 'Check handler parameters and service availability.',
            rootCauseCategory: parsed.rootCauseCategory || 'CRASH_EXCEPTION',
            analyzedAt: new Date().toISOString(),
            source: 'OPENAI',
          };
        }
      }
    } catch (err) {
      console.warn('OpenAI API call failed, attempting Gemini fallback:', err);
    }
  }

  // 2. Google Gemini API Integration
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            summary: parsed.summary || 'Job execution failed after max retries.',
            suggestedFix: parsed.suggestedFix || 'Check handler parameters and service availability.',
            rootCauseCategory: parsed.rootCauseCategory || 'CRASH_EXCEPTION',
            analyzedAt: new Date().toISOString(),
            source: 'GEMINI',
          };
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to heuristic engine:', err);
    }
  }

  // 3. Fallback Heuristic Diagnostic Engine
  return analyzeJobFailureHeuristically(context);
}

function analyzeJobFailureHeuristically(context: FailureContext): AiDiagnosticResult {
  const err = (context.finalErrorReason || '') + ' ' + (context.stackTrace || '');
  const errLower = err.toLowerCase();
  const payloadStr = JSON.stringify(context.payload);

  let category: AiDiagnosticResult['rootCauseCategory'] = 'UNKNOWN';
  let summary = `Job '${context.jobType}' failed after ${context.attempts} attempts due to an unhandled execution error.`;
  let suggestedFix = 'Inspect target handler code and verify system dependencies before replaying.';

  if (errLower.includes('simulated') || errLower.includes('crash')) {
    category = 'CRASH_EXCEPTION';
    summary = `Simulated execution handler crash detected during processing of job type '${context.jobType}'.`;
    suggestedFix = `1. Inspect the input payload data (${payloadStr.slice(0, 80)}...)\n2. Modify handler parameters to resolve simulated exception.\n3. Click "Replay" in DLQ controls to re-enqueue.`;
  } else if (errLower.includes('timeout') || errLower.includes('econnrefused') || errLower.includes('etimedout') || errLower.includes('fetch failed')) {
    category = 'NETWORK_TIMEOUT';
    summary = `Network connectivity or API timeout occurred while reaching destination service for '${context.jobType}'.`;
    suggestedFix = `1. Verify endpoint URL accessibility in payload.\n2. Ensure firewall or network routing permits outward HTTP requests.\n3. Increase timeout limits in retry policy config.`;
  } else if (errLower.includes('json') || errLower.includes('invalid') || errLower.includes('validation') || errLower.includes('syntax')) {
    category = 'PAYLOAD_FORMAT';
    summary = `Malformed or invalid JSON payload schema passed to '${context.jobType}' execution handler.`;
    suggestedFix = `1. Review input payload fields for missing required parameters.\n2. Correct schema formatting issues.\n3. Replay job from DLQ.`;
  } else if (errLower.includes('prisma') || errLower.includes('unique constraint') || errLower.includes('foreign key') || errLower.includes('database')) {
    category = 'DATABASE_CONSTRAINT';
    summary = `Database operation constraint violation or database deadlock encountered during processing.`;
    suggestedFix = `1. Check database server connection metrics.\n2. Verify target record exists and does not violate primary/unique key constraints.`;
  } else if (errLower.includes('memory') || errLower.includes('heap') || errLower.includes('enomem')) {
    category = 'RESOURCE_EXHAUSTED';
    summary = `Worker node process ran out of memory (OOM) while handling large payload batch.`;
    suggestedFix = `1. Scale worker concurrency or increase Node heap memory allocation (--max-old-space-size).\n2. Reduce payload batch size.`;
  }

  return {
    summary,
    suggestedFix,
    rootCauseCategory: category,
    analyzedAt: new Date().toISOString(),
    source: 'HEURISTIC_ENGINE',
  };
}
