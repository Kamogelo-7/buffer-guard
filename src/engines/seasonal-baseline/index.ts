import { Money, meanOf, sum } from "../../domain/money/money";
import {
  IsoDate,
  ExpenseInput,
  CategoryMonthBaseline,
  SeasonalBaselinePayload,
  EngineOutput,
  EngineWarning,
} from "../../domain/types";
import { Result, ok, err, AppError } from "../../domain/errors/result";
import { ENGINE_VERSIONS } from "../version";

export interface SeasonalBaselineInput {
  readonly expenses: readonly ExpenseInput[];
  readonly asOf: IsoDate;
  readonly lookbackYears?: number;
}

export function computeSeasonalBaseline(input: SeasonalBaselineInput): Result<EngineOutput<SeasonalBaselinePayload>> {
  const lookbackYears = input.lookbackYears ?? 5;
  const warnings: EngineWarning[] = [];
  const asOfYear = parseInt(input.asOf.split("-")[0] ?? "2026", 10);
  const cutoffYear = asOfYear - lookbackYears;

  const validExpenses = input.expenses.filter((e) => e.year >= cutoffYear);

  if (validExpenses.length === 0) {
    return err(new AppError("INSUFFICIENT_DATA", "No historical expense entries found within lookback window."));
  }

  // Group by category and month
  const cellMap = new Map<string, Money[]>();
  for (const exp of validExpenses) {
    const key = `${exp.categoryId}:${exp.month}`;
    const list = cellMap.get(key) ?? [];
    list.push(exp.amount);
    cellMap.set(key, list);
  }

  const cells: CategoryMonthBaseline[] = [];
  for (const [key, amounts] of cellMap.entries()) {
    const [categoryId = "", monthStr = "0"] = key.split(":");
    const month = parseInt(monthStr, 10);
    const sorted = [...amounts].sort((a, b) => a.compare(b));
    const min = sorted[0]!;
    const max = sorted[sorted.length - 1]!;
    const avgRes = meanOf(amounts);
    const avg = avgRes.ok ? avgRes.value : min;

    cells.push({
      categoryId,
      month,
      min,
      avg,
      max,
      sampleYears: amounts.length,
    });
  }

  // Calculate Nov + Dec seasonal envelope based on per-year sums
  const novDecByYear = new Map<number, Money[]>();
  for (const exp of validExpenses) {
    if (exp.month === 11 || exp.month === 12) {
      const yrList = novDecByYear.get(exp.year) ?? [];
      yrList.push(exp.amount);
      novDecByYear.set(exp.year, yrList);
    }
  }

  const annualNovDecTotals: Money[] = [];
  for (const [, amounts] of novDecByYear.entries()) {
    annualNovDecTotals.push(sum(amounts));
  }

  let novDecMin = Money.zero();
  let novDecAvg = Money.zero();
  let novDecMax = Money.zero();

  if (annualNovDecTotals.length > 0) {
    const sortedTotals = [...annualNovDecTotals].sort((a, b) => a.compare(b));
    novDecMin = sortedTotals[0]!;
    novDecMax = sortedTotals[sortedTotals.length - 1]!;
    const avgRes = meanOf(sortedTotals);
    novDecAvg = avgRes.ok ? avgRes.value : novDecMin;
  } else {
    warnings.push({
      code: "GAPS_IN_HISTORY",
      detail: "No historical November or December expenses logged yet.",
    });
  }

  return ok({
    meta: {
      engine: "SEASONAL_BASELINE",
      version: ENGINE_VERSIONS.SEASONAL_BASELINE,
      asOf: input.asOf,
      inputHash: `sha256_${validExpenses.length}_${input.asOf}`,
    },
    payload: {
      cells,
      novDec: {
        min: novDecMin,
        avg: novDecAvg,
        max: novDecMax,
      },
    },
    warnings,
  });
}
