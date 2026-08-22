/**
 * ============================================================================
 * Zod Request Validation Middleware — Distributed Job Scheduler
 * ============================================================================
 * Higher-order middleware factory that validates express request body, query,
 * or params against a Zod schema. If validation fails, returns a structured
 * HTTP 400 Bad Request error response detailing exact field errors.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req[target] = await schema.parseAsync(req[target]);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request payload attributes provided',
          details: formattedErrors,
        });
        return;
      }
      next(error);
    }
  };
}
