import { createClient } from "../supabase/server";
import { Result, ok, err, AppError } from "../../domain/errors/result";

export async function requireUser(): Promise<Result<{ userId: string; email: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return err(new AppError("UNAUTHENTICATED", "Active user session required to perform this action"));
  }

  return ok({
    userId: user.id,
    email: user.email ?? "",
  });
}
