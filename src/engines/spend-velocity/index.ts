import { Money, sum } from "../../domain/money/money";
import { IsoDate, SpendEntryInput, SpendVelocity } from "../../domain/types";
import { Result, ok, err, AppError } from "../../domain/errors/result";

export interface SpendVelocityInput {
  readonly spend: readonly SpendEntryInput[];
  readonly asOf: IsoDate;
  readonly year: number;
}

export function computeSpendVelocity(input: SpendVelocityInput): Result<SpendVelocity> {
  const asOfParts = input.asOf.split("-").map((s) => parseInt(s, 10));
  const asOfYear = asOfParts[0] ?? input.year;
  const asOfMonth = asOfParts[1] ?? 11;
  const asOfDay = asOfParts[2] ?? 1;

  if (asOfYear !== input.year || (asOfMonth !== 11 && asOfMonth !== 12)) {
    return err(
      new AppError(
        "ENGINE_INVARIANT",
        `Spend velocity is only evaluated during the Nov-Dec window (asOf: ${input.asOf})`
      )
    );
  }

  // Total window: Nov 1 to Dec 31 (30 days in Nov + 31 days in Dec = 61 days)
  const totalDays = 61;
  const daysElapsed = asOfMonth === 11 ? Math.max(1, asOfDay) : 30 + Math.max(1, asOfDay);
  const daysRemaining = Math.max(1, totalDays - daysElapsed);

  const novDecEntries = input.spend.filter((s) => {
    const yr = parseInt(s.occurredOn.split("-")[0] ?? "0", 10);
    const mo = parseInt(s.occurredOn.split("-")[1] ?? "0", 10);
    return yr === input.year && (mo === 11 || mo === 12) && s.occurredOn <= input.asOf;
  });

  const spentToDate = sum(novDecEntries.map((e) => e.amount));
  const dailyBurnRes = spentToDate.divInt(daysElapsed, "FLOOR");
  const dailyBurn = dailyBurnRes.ok ? dailyBurnRes.value : Money.zero();

  const burnAddition = dailyBurn.cents * BigInt(daysRemaining);
  const projectedAtBurn = spentToDate.add(Money.fromCents(burnAddition));

  return ok({
    spentToDate,
    daysElapsed,
    daysRemaining,
    dailyBurn,
    projectedAtBurn,
  });
}
