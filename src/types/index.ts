/**
 * Project PA: Core System Type Definitions (Buffer Guard / Janu-worry MVP)
 * Enforces strict structural contracts across all independent system nodes.
 */

// 1. Refurbishment & Retail Item Grading
export type ConsoleGrade = "A+" | "A" | "B" | "C" | "NEW" | "PRE_OWNED";

// 2. Risk Evaluation Metric Output
export type PredictionRiskLevel = "SAFE" | "WARNING" | "BREAKS_BANK";

// 3. Operational Action Recommendations
export type ActionRecommendation = "BUY_NOW" | "WAIT_FOR_SALE" | "WAIT_FOR_NOVEMBER" | "INSUFFICIENT_DATA";

// 4. User Financial Baseline Structure
export interface UserProfile {
  id: string;
  fullName: string;
  monthlyAllowance: number;
  fixedExpenses: number;
  januaryReserveTarget: number; // Untouchable buffer earmarked for Jan 1
  currency: "ZAR";
  updatedAt: Date;
}

// 5. Target Acquisition Item Model
export interface TrackedItem {
  id: string;
  userId: string;
  itemName: string;
  category?: string;
  targetBudget: number; // Target price user aims to pay
  ceilingPrice?: number | null; // Hard maximum; above this triggers BLOCK
  currentRetailPrice: number | null;
  desiredGrade: ConsoleGrade;
  createdAt: Date;
}

// 6. Ingestion Engine Historical Price Log
export interface PriceHistoryLog {
  id: string;
  itemId: string;
  storeName?: string; // e.g. 'Takealot', 'Makro', 'BT Games'
  loggedAt: Date;
  priceRecorded: number;
  isBlackFridayDeal: boolean;
  isFestiveSeasonDeal: boolean;
  isAnomaly: boolean; // Demand spike or pricing glitch; excluded from baseline
  discountPercentage: number; // Calculated relative to regular median baseline
}

// 7. Cyclical Holiday Spending Log
export interface SeasonalExpense {
  id: string;
  userId: string;
  expenseName: string; // e.g., 'Family Braai', 'Black Friday Spend'
  categoryKind: "HOLIDAY_CYCLICAL" | "ESSENTIAL_RECURRING" | "DISCRETIONARY";
  expenseYear: number;
  expenseMonth: number; // 1-12 boundary checks enforced
  amountSpent: number;
  createdAt: Date;
}

// 8. Macro-Economic Context Ingestion Interface
export interface MacroEconomicLog {
  id: string;
  loggedAt: Date;
  usdToZarRate: number; // Currency volatility check
  rateSpikeDetected: boolean; // True if USD/ZAR jumped >3% in 30-day window
  saCpiInflation: number; // Stats SA current CPI percentage (e.g. 4.4)
  newsSentimentScore: "BULLISH" | "BEARISH" | "NEUTRAL";
}

// 9. Enforced Gemini 1.5 Flash Structural JSON Schema Output
export interface GeminiPredictionResponse {
  calculatedAt: string;
  targetYear: number;
  estimatedNovDecCost: number;
  mandatoryJanuaryReserve: number;
  remainingSpendablePool: number;
  safeDailyBurnRate: number; // Maximum safe spend per day to keep reserve intact
  riskLevel: PredictionRiskLevel;
  recommendation: ActionRecommendation;
  strategicAdvice: string;
}
