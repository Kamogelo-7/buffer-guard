import { Money, makeBps, medianOf, meanOf, Bps } from "../../domain/money/money";
import {
  IsoDate,
  PricePointInput,
  PromoWindowInput,
  PriceStatsPayload,
  EngineOutput,
  EngineWarning,
  YearPriceStats,
  MonthPriceStats,
  DropStats,
} from "../../domain/types";
import { Result, ok, err, AppError } from "../../domain/errors/result";
import { ENGINE_VERSIONS } from "../version";

export interface PriceStatsInput {
  readonly points: readonly PricePointInput[];
  readonly windows: readonly PromoWindowInput[];
  readonly asOf: IsoDate;
  readonly lookbackYears?: number;
  readonly excludeAnomalies?: boolean;
}

export function computePriceStats(input: PriceStatsInput): Result<EngineOutput<PriceStatsPayload>> {
  const lookbackYears = input.lookbackYears ?? 5;
  const excludeAnomalies = input.excludeAnomalies ?? true;
  const warnings: EngineWarning[] = [];

  const asOfYear = parseInt(input.asOf.split("-")[0] ?? "2026", 10);
  const cutoffYear = asOfYear - lookbackYears;

  let activePoints = input.points.filter((pt) => {
    const yr = parseInt(pt.observedOn.split("-")[0] ?? "0", 10);
    return yr >= cutoffYear;
  });

  if (excludeAnomalies) {
    const originalCount = activePoints.length;
    activePoints = activePoints.filter((pt) => !pt.isAnomaly);
    if (activePoints.length < originalCount) {
      warnings.push({
        code: "ANOMALIES_EXCLUDED",
        detail: `Excluded ${originalCount - activePoints.length} anomaly price point(s) from baseline calculation.`,
      });
    }
  }

  if (activePoints.length === 0) {
    return err(new AppError("INSUFFICIENT_DATA", "No price points available within the lookback window."));
  }

  const prices = activePoints.map((p) => p.price);
  const sortedPrices = [...prices].sort((a, b) => a.compare(b));
  const min = sortedPrices[0]!;
  const max = sortedPrices[sortedPrices.length - 1]!;

  const medianRes = medianOf(prices);
  if (!medianRes.ok) return err(medianRes.error);
  const median = medianRes.value;

  const meanRes = meanOf(prices);
  if (!meanRes.ok) return err(meanRes.error);
  const mean = meanRes.value;

  // Regular baseline
  const regularPoints = activePoints.filter((p) => p.kind === "REGULAR");
  let baseline: Money;
  if (regularPoints.length > 0) {
    const regMedian = medianOf(regularPoints.map((p) => p.price));
    baseline = regMedian.ok ? regMedian.value : median;
  } else {
    baseline = median;
  }

  // Black Friday window matching
  const isBlackFriday = (pt: PricePointInput): boolean => {
    if (pt.kind === "BLACK_FRIDAY") return true;
    return input.windows.some(
      (w) => w.kind === "BLACK_FRIDAY" && pt.observedOn >= w.startsOn && pt.observedOn <= w.endsOn
    );
  };

  const bfPoints = activePoints.filter(isBlackFriday);
  const salePoints = activePoints.filter((p) => p.kind === "SALE" && !isBlackFriday(p));

  const calcDrop = (samplePoints: PricePointInput[]): DropStats => {
    if (samplePoints.length === 0 || baseline.cents === 0n) {
      return { samples: 0, avgBps: null, maxBps: null, yearsObserved: [] };
    }
    const dropBpsList: Bps[] = [];
    const yearsSet = new Set<number>();

    for (const pt of samplePoints) {
      const yr = parseInt(pt.observedOn.split("-")[0] ?? "0", 10);
      yearsSet.add(yr);
      const diff = baseline.sub(pt.price);
      const ratioRes = diff.ratioBps(baseline);
      if (ratioRes.ok) {
        dropBpsList.push(ratioRes.value);
      }
    }

    if (dropBpsList.length === 0) {
      return { samples: 0, avgBps: null, maxBps: null, yearsObserved: [] };
    }

    const avg = makeBps(dropBpsList.reduce((acc, b) => acc + b, 0) / dropBpsList.length);
    const maxDrop = makeBps(Math.max(...dropBpsList));

    return {
      samples: samplePoints.length,
      avgBps: avg,
      maxBps: maxDrop,
      yearsObserved: Array.from(yearsSet).sort(),
    };
  };

  const blackFridayDrop = calcDrop(bfPoints);
  const saleDrop = calcDrop(salePoints);

  // Group by year
  const pointsByYear = new Map<number, PricePointInput[]>();
  for (const pt of activePoints) {
    const yr = parseInt(pt.observedOn.split("-")[0] ?? "0", 10);
    const existing = pointsByYear.get(yr) ?? [];
    existing.push(pt);
    pointsByYear.set(yr, existing);
  }

  const byYear: YearPriceStats[] = [];
  for (const [yr, yrPts] of pointsByYear.entries()) {
    const yrPrices = yrPts.map((p) => p.price).sort((a, b) => a.compare(b));
    const yrRegs = yrPts.filter((p) => p.kind === "REGULAR").map((p) => p.price);
    const yrBf = yrPts.filter(isBlackFriday).map((p) => p.price).sort((a, b) => a.compare(b));

    let regularMedian: Money | null = null;
    if (yrRegs.length > 0) {
      const regRes = medianOf(yrRegs);
      if (regRes.ok) {
        regularMedian = regRes.value;
      }
    }

    byYear.push({
      year: yr,
      low: yrPrices[0]!,
      high: yrPrices[yrPrices.length - 1]!,
      regularMedian,
      blackFridayLow: yrBf[0] ?? null,
    });
  }
  byYear.sort((a, b) => a.year - b.year);

  // Group by month
  const pointsByMonth = new Map<number, PricePointInput[]>();
  for (const pt of activePoints) {
    const m = parseInt(pt.observedOn.split("-")[1] ?? "0", 10);
    const existing = pointsByMonth.get(m) ?? [];
    existing.push(pt);
    pointsByMonth.set(m, existing);
  }

  const byMonth: MonthPriceStats[] = [];
  let bestMonth: number | null = null;
  let highestDiscountBps: number = -Infinity;

  for (let m = 1; m <= 12; m++) {
    const mPts = pointsByMonth.get(m) ?? [];
    if (mPts.length === 0) {
      byMonth.push({ month: m, samples: 0, avgDiscountBps: null });
      continue;
    }
    const discounts: number[] = [];
    for (const pt of mPts) {
      const diff = baseline.sub(pt.price);
      const ratioRes = diff.ratioBps(baseline);
      if (ratioRes.ok) discounts.push(ratioRes.value);
    }
    const avgDisc = discounts.length > 0 ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length) : null;
    byMonth.push({
      month: m,
      samples: mPts.length,
      avgDiscountBps: avgDisc !== null ? makeBps(avgDisc) : null,
    });

    if (mPts.length >= 2 && avgDisc !== null && avgDisc > highestDiscountBps) {
      highestDiscountBps = avgDisc;
      bestMonth = m;
    }
  }

  // Confidence scoring
  const distinctYears = pointsByYear.size;
  let confidence: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (distinctYears >= 4 && activePoints.length >= 12) {
    confidence = "HIGH";
  } else if (distinctYears >= 2 && activePoints.length >= 6) {
    confidence = "MEDIUM";
  }

  if (activePoints.length < 6) {
    warnings.push({
      code: "FEW_SAMPLES",
      detail: `Sample count (${activePoints.length}) is below recommended 6 samples for reliable confidence.`,
    });
  }

  return ok({
    meta: {
      engine: "PRICE_STATS",
      version: ENGINE_VERSIONS.PRICE_STATS,
      asOf: input.asOf,
      inputHash: `sha256_${activePoints.length}_${input.asOf}`,
    },
    payload: {
      sampleSize: activePoints.length,
      range: { min, max, median, mean },
      baseline,
      byYear,
      byMonth,
      saleDrop,
      blackFridayDrop,
      bestMonth,
      confidence,
    },
    warnings,
  });
}
