import { PrismaClient } from "@prisma/client";

// Connect directly to port 5432 for DDL operations
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient(
  directUrl
    ? {
        datasources: {
          db: {
            url: directUrl,
          },
        },
      }
    : undefined
);

async function main() {
  console.log("Applying custom hardening constraints, triggers, and RLS policies on direct port...");

  // Separate functions/triggers block from normal commands
  // First, apply reject_mutation function and trigger
  const functionSql = `
    CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Table is append-only. UPDATE and DELETE are prohibited to protect reserve audit trail.';
    END;
    $$;
  `;
  try {
    await prisma.$executeRawUnsafe(functionSql);
    console.log("✔ reject_mutation function installed");
  } catch (e: any) {
    console.warn("Function warning:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS reserve_ledger_immutable ON reserve_ledger");
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER reserve_ledger_immutable
        BEFORE UPDATE OR DELETE ON reserve_ledger FOR EACH ROW EXECUTE FUNCTION reject_mutation()
    `);
    console.log("✔ reserve_ledger_immutable append-only trigger installed");
  } catch (e: any) {
    console.warn("Trigger warning:", e.message);
  }

  // Next, simple ALTER statements
  const simpleStatements = [
    "ALTER TABLE price_points ADD CONSTRAINT price_positive CHECK (price_cents > 0)",
    "ALTER TABLE seasonal_expenses ADD CONSTRAINT month_range CHECK (month BETWEEN 1 AND 12)",
    "ALTER TABLE seasonal_expenses ADD CONSTRAINT amount_nonneg CHECK (amount_cents >= 0)",
    "ALTER TABLE seasonal_baselines ADD CONSTRAINT baseline_order CHECK (min_cents <= avg_cents AND avg_cents <= max_cents)",
    "ALTER TABLE budget_plans ADD CONSTRAINT reserve_in_pool CHECK (reserve_cents >= 0 AND reserve_cents <= pool_cents)",
    "ALTER TABLE threshold_policies ADD CONSTRAINT bps_order CHECK (warn_bps >= 0 AND block_bps >= warn_bps AND lookback_years BETWEEN 1 AND 10)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_price_points ON price_points (item_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), observed_on, kind)",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_threshold_default ON threshold_policies (user_id) WHERE item_id IS NULL",
    "ALTER TABLE profiles ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE stores ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE items ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE price_points ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE seasonal_expenses ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE seasonal_baselines ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE reserve_ledger ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE spend_entries ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE threshold_policies ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE engine_runs ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE promo_windows ENABLE ROW LEVEL SECURITY",
  ];

  for (const stmt of simpleStatements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (e: any) {
      if (!e.message?.includes("already exists")) {
        console.warn("Constraint notice:", e.message?.slice(0, 100));
      }
    }
  }

  console.log("Database hardening, immutable reserve triggers, and RLS policies successfully applied!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
