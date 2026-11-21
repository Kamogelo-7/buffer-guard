import { z } from "zod";
import { Result } from "../../domain/errors/result";
import { ErrorCode } from "../../domain/errors/result";
import { requireUser } from "../auth/require-user";

export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: ErrorCode;
        readonly message: string;
        readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
      };
    };

export function createAction<S extends z.ZodTypeAny, T>(config: {
  readonly name: string;
  readonly schema: S;
  readonly requireAuth?: boolean;
  readonly handler: (
    input: z.infer<S>,
    ctx: { readonly userId: string; readonly requestId: string }
  ) => Promise<Result<T>>;
}) {
  return async (rawInput: unknown): Promise<ActionResult<T>> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let userId = "00000000-0000-0000-0000-000000000001";
    if (config.requireAuth !== false) {
      const userRes = await requireUser();
      if (!userRes.ok) {
        return {
          ok: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required",
          },
        };
      }
      userId = userRes.value.userId;
    }

    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        const list = fieldErrors[path] ?? [];
        list.push(issue.message);
        fieldErrors[path] = list;
      }
      return {
        ok: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "Input validation failed",
          fieldErrors,
        },
      };
    }

    try {
      const result = await config.handler(parsed.data, { userId, requestId });
      if (!result.ok) {
        return {
          ok: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        };
      }
      return {
        ok: true,
        data: result.value,
      };
    } catch (e) {
      console.error(`[Server Action Error: ${config.name}]`, e);
      return {
        ok: false,
        error: {
          code: "UNEXPECTED",
          message: "An unexpected error occurred while processing the request.",
        },
      };
    }
  };
}
