-- Hardening Migration: Check constraints, append-only triggers, RLS policies

-- 1. Value Constraints
ALTER TABLE price_points ADD CONSTRAINT price_positive CHECK (price_cents > 0);
ALTER TABLE seasonal_expenses ADD CONSTRAINT month_range CHECK (month BETWEEN 1 AND 12);
ALTER TABLE seasonal_expenses ADD CONSTRAINT amount_nonneg CHECK (amount_cents >= 0);
ALTER TABLE seasonal_baselines ADD CONSTRAINT baseline_order CHECK (min_cents <= avg_cents AND avg_cents <= max_cents);
ALTER TABLE budget_plans ADD CONSTRAINT reserve_in_pool CHECK (reserve_cents >= 0 AND reserve_cents <= pool_cents);
ALTER TABLE threshold_policies ADD CONSTRAINT bps_order CHECK (warn_bps >= 0 AND block_bps >= warn_bps AND lookback_years BETWEEN 1 AND 10);

-- 2. NULL-Safe Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS uq_price_points ON price_points
  (item_id, COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid), observed_on, kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_threshold_default ON threshold_policies (user_id) WHERE item_id IS NULL;

-- 3. Append-Only Trigger for Reserve Ledger
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table is append-only. UPDATE and DELETE are prohibited to protect reserve audit trail.';
END;
$$;

DROP TRIGGER IF EXISTS reserve_ledger_immutable ON reserve_ledger;
CREATE TRIGGER reserve_ledger_immutable
  BEFORE UPDATE OR DELETE ON reserve_ledger FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- 4. Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_owner ON profiles FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_owner ON stores FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_owner ON items FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE price_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY price_points_owner ON price_points FOR ALL
  USING (EXISTS (SELECT 1 FROM items i WHERE i.id = price_points.item_id AND i.user_id = auth.uid()));

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_categories_owner ON expense_categories FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE seasonal_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY seasonal_expenses_owner ON seasonal_expenses FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE seasonal_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY seasonal_baselines_owner ON seasonal_baselines FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY budget_plans_owner ON budget_plans FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE reserve_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY reserve_ledger_owner ON reserve_ledger FOR ALL
  USING (EXISTS (SELECT 1 FROM budget_plans b WHERE b.id = reserve_ledger.plan_id AND b.user_id = auth.uid()));

ALTER TABLE spend_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY spend_entries_owner ON spend_entries FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE threshold_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY threshold_policies_owner ON threshold_policies FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY engine_runs_owner ON engine_runs FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY risk_assessments_owner ON risk_assessments FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE promo_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_read ON promo_windows FOR SELECT TO authenticated USING (true);
