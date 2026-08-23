/**
 * ============================================================================
 * Dynamic Payload Template Interpolator — Distributed Job Scheduler
 * ============================================================================
 * Resolves template variables in string values (e.g. `{{event.userId}}` or `{{amount}}`)
 * by looking up nested values in the incoming event context object.
 *
 * Example:
 *   Template: { "recipient": "{{event.email}}", "invoiceId": "INV-{{event.id}}" }
 *   Context:  { event: { email: "user@example.com", id: "12345" } }
 *   Result:   { "recipient": "user@example.com", "invoiceId": "INV-12345" }
 */

/**
 * Traverses a nested object using dot notation path (e.g. 'event.user.id').
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;

  // If path starts with 'event.' or 'payload.', normalize lookup
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Replaces all {{path.to.variable}} occurrences in a string template.
 */
function interpolateString(str: string, context: Record<string, any>): any {
  const exactMatch = str.match(/^\{\{([^}]+)\}\}$/);
  if (exactMatch) {
    const key = exactMatch[1].trim();
    // Check direct context, or nested in context.event / context.payload
    let val = getNestedValue(context, key);
    if (val === undefined && context.event) {
      val = getNestedValue(context.event, key);
    }
    if (val === undefined && context.payload) {
      val = getNestedValue(context.payload, key);
    }
    return val !== undefined ? val : str;
  }

  // Substring replacement
  return str.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmed = key.trim();
    let val = getNestedValue(context, trimmed);
    if (val === undefined && context.event) {
      val = getNestedValue(context.event, trimmed);
    }
    if (val === undefined && context.payload) {
      val = getNestedValue(context.payload, trimmed);
    }
    return val !== undefined ? String(val) : `{{${trimmed}}}`;
  });
}

/**
 * Recursively interpolates any data structure (Object, Array, Primitive).
 */
export function interpolatePayload(template: any, context: Record<string, any>): any {
  if (template === null || template === undefined) {
    return context.payload || context;
  }

  if (typeof template === 'string') {
    return interpolateString(template, context);
  }

  if (Array.isArray(template)) {
    return template.map((item) => interpolatePayload(item, context));
  }

  if (typeof template === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = interpolatePayload(value, context);
    }
    return result;
  }

  return template;
}

/**
 * Pattern matching for event names supporting simple wildcards:
 * - "payment.*" matches "payment.success", "payment.failed"
 * - "*" matches all events
 * - Exact matches "user.registered"
 */
export function matchEventPattern(pattern: string, eventType: string): boolean {
  if (pattern === '*' || pattern === eventType) {
    return true;
  }

  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(`${prefix}.`);
  }

  return false;
}
