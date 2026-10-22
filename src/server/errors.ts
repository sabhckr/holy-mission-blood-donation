/** Message keys resolve through the `errors` and `validation` i18n namespaces. */
export type ErrorCode = 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'invalid_state';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    /** Key in the `errors` namespace. */
    public readonly messageKey: string = code,
    /** Field name -> key in the `validation` namespace. */
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(`${code}: ${messageKey}`);
    this.name = 'AppError';
  }
}

export const forbidden = (key = 'forbidden') => new AppError('forbidden', key);
export const notFound = (key = 'not_found') => new AppError('not_found', key);
export const conflict = (key: string, fieldErrors: Record<string, string> = {}) => new AppError('conflict', key, fieldErrors);
export const invalidState = (key = 'invalid_state') => new AppError('invalid_state', key);
export const validationError = (fieldErrors: Record<string, string>, key = 'validation') => new AppError('validation', key, fieldErrors);

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const e = error as { code?: string; constraint_name?: string; cause?: { code?: string; constraint_name?: string } };
  const pg = e?.code ? e : e?.cause;
  if (pg?.code !== '23505') return false;
  return constraint ? pg.constraint_name === constraint : true;
}
