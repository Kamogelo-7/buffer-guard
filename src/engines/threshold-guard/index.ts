import { Money, Bps } from "../../domain/money/money";
import {
  IsoDate,
  ItemCondition,
  PriceStatsPayload,
  JanuaryOutlookPayload,
  RiskAssessmentPayload,
  RiskSeverity,
  Recommendation,
  ReasonCode,
  EngineOutput,
} from "../../domain/types";
import { Result, ok } from "../../domain/errors/result";
import { ENGINE_VERSIONS } from "../version";

export interface ThresholdPolicyInput {
  readonly lookbackYears: number;
  readonly warnBps: Bps;
  readonly blockBps: Bps;
  readonly minSamples: number;
}

export interface ThresholdGuardInput {
  readonly item: {
    readonly id: string;
    readonly condition: ItemCondition;
    readonly target: Money | null;
    readonly ceiling: Money | null;
  };
  readonly candidate: {
    readonly price: Money;
    readonly observedOn: IsoDate;
  };
  readonly stats: PriceStatsPayload;
  readonly policy: ThresholdPolicyInput;
  readonly outlook: JanuaryOutlookPayload | null;
  readonly asOf: IsoDate;
}

export function evaluateThresholdGuard(input: ThresholdGuardInput): Result<EngineOutput<RiskAssessmentPayload>> {
  const reasons: { readonly code: ReasonCode; readonly detail: string }[] = [];
  let severity: RiskSeverity = "INFO";
  let recommendation: Recommendation = "BUY_NOW";

  const { candidate, item, stats, policy, outlook } = input;

  // 1. Hard Ceiling Check
  if (item.ceiling && candidate.price.cents > item.ceiling.cents) {
    severity = "BLOCK";
    recommendation = "WAIT_FOR_SALE";
    reasons.push({
      code: "ABOVE_CEILING",
      detail: `Candidate price ${candidate.price.format()} exceeds hard maximum ceiling ${item.ceiling.format()}.`,
    });
    return buildOutput(input, severity, recommendation, reasons, null);
  }

  // 2. January Reserve Check (Spend Gate)
  if (outlook && candidate.price.cents > outlook.remainingSpendable.cents) {
    severity = "BLOCK";
    recommendation = "WAIT_FOR_SALE";
    reasons.push({
      code: "RESERVE_BREACH",
      detail: `Purchasing this item will breach the untouchable January reserve by ${candidate.price.sub(outlook.remainingSpendable).format()}.`,
    });
    return buildOutput(input, severity, recommendation, reasons, null);
  }

  // 3. Insufficient History Check
  if (stats.sampleSize < policy.minSamples) {
    severity = "INFO";
    recommendation = "INSUFFICIENT_DATA";
    reasons.push({
      code: "INSUFFICIENT_HISTORY",
      detail: `Only ${stats.sampleSize} samples logged (minimum ${policy.minSamples} required for high-confidence guidance).`,
    });
  }

  // 4. Deviation vs Historical Range
  let vsMaxBps: Bps | null = null;

  if (candidate.price.cents > stats.range.max.cents) {
    const diff = candidate.price.sub(stats.range.max);
    const bpsRes = diff.ratioBps(stats.range.max);
    if (bpsRes.ok) {
      vsMaxBps = bpsRes.value;
      if (vsMaxBps >= policy.blockBps) {
        severity = "HIGH";
        recommendation = "WAIT_FOR_SALE";
      } else if (vsMaxBps >= policy.warnBps) {
        severity = "MEDIUM";
        recommendation = "WAIT_FOR_SALE";
      } else {
        severity = "LOW";
      }
      reasons.push({
        code: "ABOVE_HISTORICAL_MAX",
        detail: `Price is ${vsMaxBps / 100}% higher than the 5-year recorded maximum of ${stats.range.max.format()}.`,
      });
    }
  }

  // 5. Black Friday & Seasonal timing recommendation
  const asOfMonth = parseInt(input.asOf.split("-")[1] ?? "1", 10);
  const bfDropBps = stats.blackFridayDrop.avgBps;

  let expectedSavingIfWait: Money | null = null;

  if (bfDropBps && bfDropBps > 0 && stats.blackFridayDrop.samples >= 2) {
    if (asOfMonth < 11) {
      recommendation = "WAIT_FOR_NOVEMBER";
      reasons.push({
        code: "BETTER_PRICE_LIKELY_LATER",
        detail: `Black Friday consistently yields an average ${bfDropBps / 100}% drop for this item.`,
      });
      const savingEst = candidate.price.mulBps(bfDropBps);
      expectedSavingIfWait = savingEst;
    }
  } else if (stats.saleDrop.avgBps && stats.saleDrop.avgBps > 500) {
    if (severity !== "HIGH") {
      recommendation = "WAIT_FOR_SALE";
    }
  }

  // If item is below user target and not blocked
  if (item.target && candidate.price.cents <= item.target.cents && severity !== "HIGH") {
    recommendation = "BUY_NOW";
  }

  return buildOutput(input, severity, recommendation, reasons, expectedSavingIfWait);
}

function buildOutput(
  input: ThresholdGuardInput,
  severity: RiskSeverity,
  recommendation: Recommendation,
  reasons: { readonly code: ReasonCode; readonly detail: string }[],
  expectedSavingIfWait: Money | null
): Result<EngineOutput<RiskAssessmentPayload>> {
  return ok({
    meta: {
      engine: "THRESHOLD_ASSESSMENT",
      version: ENGINE_VERSIONS.THRESHOLD_GUARD,
      asOf: input.asOf,
      inputHash: `sha256_risk_${input.item.id}_${input.asOf}`,
    },
    payload: {
      severity,
      recommendation,
      reasons,
      deviation: {
        vsMaxBps: null,
        vsMinBps: null,
        vsMedianBps: null,
        vsBlackFridayLowBps: null,
      },
      expectedSavingIfWait,
    },
    warnings: [],
  });
}
