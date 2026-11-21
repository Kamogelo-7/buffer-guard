import { EnvironmentSchema } from "../domain/schemas";

function getValidatedEnv() {
  const parsed = EnvironmentSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("⚠️ [Environment Warning]: Some environment variables are not populated yet:", parsed.error.format());
    return {
      DATABASE_URL: process.env["DATABASE_URL"] ?? "",
      DIRECT_URL: process.env["DIRECT_URL"] ?? "",
      NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
      CRON_SECRET: process.env["CRON_SECRET"] ?? "",
      GEMINI_API_KEY: process.env["GEMINI_API_KEY"] ?? "",
    };
  }
  return parsed.data;
}

export const env = getValidatedEnv();
