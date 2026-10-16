export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}

export function assert(condition: unknown, code: string, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(status, code, message);
}
