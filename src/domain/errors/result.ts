export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DB_UNAVAILABLE"
  | "DB_ROW_INVALID"
  | "INSUFFICIENT_DATA"
  | "RESERVE_BREACH"
  | "ENGINE_INVARIANT"
  | "UNEXPECTED";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    override readonly message: string,
    readonly retryable: boolean = false,
    override readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type Result<T, E extends AppError = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E extends AppError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
