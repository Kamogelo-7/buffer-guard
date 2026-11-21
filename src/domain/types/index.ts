import { Money, Bps } from "../money/money";

export type IsoDate = string; // Format: YYYY-MM-DD

export type ItemCondition = "NEW" | "PRE_OWNED";
export type ItemStatus = "TRACKING" | "PURCHASED" | "ARCHIVED";
export type PriceKind = "REGULAR" | "SALE" | "BLACK_FRIDAY" | "CYBER_MONDAY" | "USED_LISTING";
export type PromoKind = "BLACK_FRIDAY" | "CYBER_MONDAY" | "EASTER" | "MID_YEAR" | "BOXING_DAY" | "CUSTOM";
export type ExpenseKind = "HOLIDAY_CYCLICAL" | "ESSENTIAL_RECURRING" | "DISCRETIONARY";
export type PlanStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ReserveEventType = "LOCK" | "ADJUST" | "OVERRIDE_REQUESTED" | "OVERRIDE_APPROVED" | "OVERRIDE_DENIED" | "RELEASE";
export type EngineKind = "PRICE_STATS" | "SEASONAL_BASELINE" | "JANUARY_OUTLOOK" | "THRESHOLD_ASSESSMENT";
export type RiskSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "BLOCK";
export type Recommendation = "BUY_NOW" | "WAIT_FOR_SALE" | "WAIT_FOR_NOVEMBER" | "INSUFFICIENT_DATA";
export type OutlookStatus = "SAFE" | "WATCH" | "BREACH";
export type ScenarioName = "LOW" | "EXPECTED" | "HIGH";

export type ReasonCode =
  | "ABOVE_HISTORICAL_MAX"
  | "BELOW_HISTORICAL_MIN"
  | "ABOVE_CEILING"
  | "ABOVE_TARGET"
  | "IN_ANOMALY_PERIOD"
  | "INSUFFICIENT_HISTORY"
  | "RESERVE_BREACH"
  | "BETTER_PRICE_LIKELY_LATER";

export interface EngineMeta {
  readonly engine: EngineKind;
  readonly version: string;
  readonly asOf: IsoDate;
  readonly inputHash: string;
}

export interface EngineWarning {
  readonly code: "FEW_SAMPLES" | "STALE_DATA" | "ANOMALIES_EXCLUDED" | "GAPS_IN_HISTORY";
  readonly detail: string;
}

export interface EngineOutput<P> {
  readonly meta: EngineMeta;
  readonly payload: P;
  readonly warnings: readonly EngineWarning[];
}

export interface PricePointInput {
  readonly id: string;
  readonly observedOn: IsoDate;
  readonly price: Money;
  readonly kind: PriceKind;
  readonly isAnomaly: boolean;
  readonly storeId: string | null;
}

export interface PromoWindowInput {
  readonly kind: PromoKind;
  readonly year: number;
  readonly startsOn: IsoDate;
  readonly endsOn: IsoDate;
}

export interface DropStats {
  readonly samples: number;
  readonly avgBps: Bps | null;
  readonly maxBps: Bps | null;
  readonly yearsObserved: readonly number[];
}

export interface YearPriceStats {
  readonly year: number;
  readonly low: Money;
  readonly high: Money;
  readonly regularMedian: Money | null;
  readonly blackFridayLow: Money | null;
}

export interface MonthPriceStats {
  readonly month: number;
  readonly samples: number;
  readonly avgDiscountBps: Bps | null;
}

export interface PriceStatsPayload {
  readonly sampleSize: number;
  readonly range: {
    readonly min: Money;
    readonly max: Money;
    readonly median: Money;
    readonly mean: Money;
  };
  readonly baseline: Money;
  readonly byYear: readonly YearPriceStats[];
  readonly byMonth: readonly MonthPriceStats[];
  readonly saleDrop: DropStats;
  readonly blackFridayDrop: DropStats;
  readonly bestMonth: number | null;
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
}

export interface ExpenseInput {
  readonly categoryId: string;
  readonly year: number;
  readonly month: number;
  readonly amount: Money;
}

export interface CategoryMonthBaseline {
  readonly categoryId: string;
  readonly month: number;
  readonly min: Money;
  readonly avg: Money;
  readonly max: Money;
  readonly sampleYears: number;
}

export interface SeasonalBaselinePayload {
  readonly cells: readonly CategoryMonthBaseline[];
  readonly novDec: {
    readonly min: Money;
    readonly avg: Money;
    readonly max: Money;
  };
}

export interface SpendEntryInput {
  readonly occurredOn: IsoDate;
  readonly amount: Money;
  readonly categoryId: string | null;
}

export interface SpendVelocity {
  readonly spentToDate: Money;
  readonly daysElapsed: number;
  readonly daysRemaining: number;
  readonly dailyBurn: Money;
  readonly projectedAtBurn: Money;
}

export interface ScenarioProjection {
  readonly name: ScenarioName;
  readonly projectedNovDec: Money;
  readonly januaryPosition: Money;
  readonly reserveIntact: boolean;
}

export interface JanuaryOutlookPayload {
  readonly status: OutlookStatus;
  readonly spendable: Money;
  readonly remainingSpendable: Money;
  readonly velocity: SpendVelocity;
  readonly scenarios: readonly [ScenarioProjection, ScenarioProjection, ScenarioProjection];
  readonly reserveAtRisk: Money;
  readonly dailyHeadroom: Money;
}

export interface Deviation {
  readonly vsMaxBps: Bps | null;
  readonly vsMinBps: Bps | null;
  readonly vsMedianBps: Bps | null;
  readonly vsBlackFridayLowBps: Bps | null;
}

export interface RiskAssessmentPayload {
  readonly severity: RiskSeverity;
  readonly recommendation: Recommendation;
  readonly reasons: readonly { readonly code: ReasonCode; readonly detail: string }[];
  readonly deviation: Deviation;
  readonly expectedSavingIfWait: Money | null;
}
