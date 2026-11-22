import { z } from "zod";

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid ISO Date (YYYY-MM-DD)");

export const ItemConditionSchema = z.enum(["NEW", "PRE_OWNED"]);
export const ItemStatusSchema = z.enum(["TRACKING", "PURCHASED", "ARCHIVED"]);
export const PriceKindSchema = z.enum(["REGULAR", "SALE", "BLACK_FRIDAY", "CYBER_MONDAY", "USED_LISTING"]);
export const PromoKindSchema = z.enum(["BLACK_FRIDAY", "CYBER_MONDAY", "EASTER", "MID_YEAR", "BOXING_DAY", "CUSTOM"]);
export const ExpenseKindSchema = z.enum(["HOLIDAY_CYCLICAL", "ESSENTIAL_RECURRING", "DISCRETIONARY"]);
export const PlanStatusSchema = z.enum(["DRAFT", "ACTIVE", "CLOSED"]);
export const RiskSeveritySchema = z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "BLOCK"]);
export const RecommendationSchema = z.enum(["BUY_NOW", "WAIT_FOR_SALE", "WAIT_FOR_NOVEMBER", "INSUFFICIENT_DATA"]);

export const CreateItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(120),
  category: z.string().optional(),
  condition: ItemConditionSchema.default("NEW"),
  targetPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required").optional(),
  ceilingPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required").optional(),
});

export const LogPricePointSchema = z.object({
  itemId: z.string().uuid(),
  storeName: z.string().min(1).max(80).optional(),
  observedOn: IsoDateSchema,
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required"),
  kind: PriceKindSchema.default("REGULAR"),
  isAnomaly: z.boolean().default(false),
  note: z.string().max(255).optional(),
});

export const LogSeasonalSpendSchema = z.object({
  categoryName: z.string().min(1).max(80),
  year: z.number().int().min(2015).max(2035),
  month: z.number().int().min(1).max(12),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required"),
  note: z.string().max(255).optional(),
});

export const CreateBudgetPlanSchema = z.object({
  year: z.number().int().min(2020).max(2035),
  totalPool: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required"),
  januaryReserve: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valid ZAR amount required"),
});

export const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});
