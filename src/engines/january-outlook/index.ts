import { Money } from "../../domain/money/money";
import {
  IsoDate,
  SpendEntryInput,
  SeasonalBaselinePayload,
  JanuaryOutlookPayload,
  ScenarioProjection,
  OutlookStatus,
  EngineOutput,
  EngineWarning,
} from "../../domain/types";
import { Result, ok, err } from "../../domain/errors/result";
import { computeSpendVelocity } from "../spend-velocity";
import { ENGINE_VERSIONS } from "../version";

export interface JanuaryOutlookInput {
  readonly plan: {
    readonly year: number;
    readonly pool: Money;
    readonly reserveTarget: Money;
  };
  readonly reserveLocked: Money;
  readonly baselines: SeasonalBaselinePayload;
  readonly spend: readonly SpendEntryInput[];
  readonly asOf: IsoDate;
}

export type SpendGateDecision =
  | { readonly kind: "ALLOW"; readonly remainingAfter: Money }
  | { readonly kind: "WARN"; readonly remainingAfter: Money; readonly reason: "EXCEEDS_EXPECTED_PACE" }
  | { readonly kind: "BLOCK"; readonly reason: "WOULD_TOUCH_RESERVE"; readonly shortfall: Money };

export function computeJanuaryOutlook(input: JanuaryOutlookInput): Result<EngineOutput<JanuaryOutlookPayload>> {
  const warnings: EngineWarning[] = [];
  const velocityRes = computeSpendVelocity({
    spend: input.spend,
    asOf: input.asOf,
    year: input.plan.year,
  });

  if (!velocityRes.ok) return err(velocityRes.error);
  const velocity = velocityRes.value;

  // The untouchable reserve constraint:
  // spendable = total earmarked pool - current locked reserve
  const spendable = input.plan.pool.sub(input.reserveLocked);
  const remainingSpendable = spendable.sub(velocity.spentToDate);

  const baselineNovDec = input.baselines.novDec;
  const totalDays = 61;
  const remainingRatio = velocity.daysRemaining / totalDays;

  const proratedRemaining = (envelopeMoney: Money): Money => {
    const raw = Number(envelopeMoney.cents) * remainingRatio;
    return Money.fromCents(BigInt(Math.round(raw)));
  };

  const lowRemaining = proratedRemaining(baselineNovDec.min);
  const expectedRemaining = proratedRemaining(baselineNovDec.avg);
  const highBaselineRemaining = proratedRemaining(baselineNovDec.max);

  // HIGH scenario uses the higher of historical max pace or current burn rate
  const projectedHigh =
    velocity.projectedAtBurn.cents > velocity.spentToDate.add(highBaselineRemaining).cents
      ? velocity.projectedAtBurn
      : velocity.spentToDate.add(highBaselineRemaining);

  const buildScenario = (name: "LOW" | "EXPECTED" | "HIGH", projected: Money): ScenarioProjection => {
    const januaryPosition = input.plan.pool.sub(projected);
    const reserveIntact = januaryPosition.cents >= input.plan.reserveTarget.cents;
    return {
      name,
      projectedNovDec: projected,
      januaryPosition,
      reserveIntact,
    };
  };

  const lowScenario = buildScenario("LOW", velocity.spentToDate.add(lowRemaining));
  const expectedScenario = buildScenario("EXPECTED", velocity.spentToDate.add(expectedRemaining));
  const highScenario = buildScenario("HIGH", projectedHigh);

  let status: OutlookStatus = "SAFE";
  if (expectedScenario.projectedNovDec.cents > spendable.cents) {
    status = "BREACH";
  } else if (highScenario.projectedNovDec.cents > spendable.cents) {
    status = "WATCH";
  }

  let reserveAtRisk = Money.zero();
  if (status === "BREACH") {
    reserveAtRisk = expectedScenario.projectedNovDec.sub(spendable);
  }

  let dailyHeadroom = Money.zero();
  if (remainingSpendable.cents > expectedRemaining.cents) {
    const surplus = remainingSpendable.sub(expectedRemaining);
    const headroomRes = surplus.divInt(velocity.daysRemaining, "FLOOR");
    dailyHeadroom = headroomRes.ok ? headroomRes.value : Money.zero();
  }

  return ok({
    meta: {
      engine: "JANUARY_OUTLOOK",
      version: ENGINE_VERSIONS.JANUARY_OUTLOOK,
      asOf: input.asOf,
      inputHash: `sha256_outlook_${input.plan.year}_${input.asOf}`,
    },
    payload: {
      status,
      spendable,
      remainingSpendable,
      velocity,
      scenarios: [lowScenario, expectedScenario, highScenario],
      reserveAtRisk,
      dailyHeadroom,
    },
    warnings,
  });
}

export function evaluateSpendGate(outlook: JanuaryOutlookPayload, amount: Money): SpendGateDecision {
  if (amount.cents > outlook.remainingSpendable.cents) {
    return {
      kind: "BLOCK",
      reason: "WOULD_TOUCH_RESERVE",
      shortfall: amount.sub(outlook.remainingSpendable),
    };
  }

  const remainingAfter = outlook.remainingSpendable.sub(amount);

  if (remainingAfter.cents < 0n) {
    return {
      kind: "WARN",
      remainingAfter,
      reason: "EXCEEDS_EXPECTED_PACE",
    };
  }

  return {
    kind: "ALLOW",
    remainingAfter,
  };
}
