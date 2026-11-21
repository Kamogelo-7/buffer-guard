import { pricePointRepository } from "../repositories/price-point.repository";
import { itemRepository } from "../repositories/item.repository";
import { budgetPlanRepository } from "../repositories/budget-plan.repository";
import { computePriceStats } from "../engines/price-stats";
import { computeJanuaryOutlook } from "../engines/january-outlook";
import { evaluateThresholdGuard } from "../engines/threshold-guard";
import { aiAdvisoryService } from "./ai-advisory.service";
import { defaultClock } from "../lib/time/clock";
import { Money } from "../domain/money/money";
import { Result, ok, err, AppError } from "../domain/errors/result";
import { RiskAssessmentPayload, PriceStatsPayload, JanuaryOutlookPayload } from "../domain/types";

export interface EvaluationOutcome {
  stats: PriceStatsPayload;
  outlook: JanuaryOutlookPayload | null;
  assessment: RiskAssessmentPayload;
  aiAdvisory: string;
}

export class CoreDecisionOrchestrator {
  async evaluateItemPrice(
    userId: string,
    itemId: string,
    candidatePrice: Money
  ): Promise<Result<EvaluationOutcome>> {
    const itemRes = await itemRepository.getById(userId, itemId);
    if (!itemRes.ok) return err(itemRes.error);
    const item = itemRes.value;

    const pointsRes = await pricePointRepository.listForItem(userId, itemId);
    if (!pointsRes.ok) return err(pointsRes.error);

    const today = defaultClock.todayIso();
    const currentYear = parseInt(today.split("-")[0] ?? "2026", 10);

    // Compute stats
    const statsRes = computePriceStats({
      points: pointsRes.value,
      windows: [],
      asOf: today,
    });
    if (!statsRes.ok) return err(statsRes.error);
    const stats = statsRes.value.payload;

    // Load active budget plan
    const planRes = await budgetPlanRepository.getByYear(userId, currentYear);
    let outlook: JanuaryOutlookPayload | null = null;
    if (planRes.ok && planRes.value) {
      const plan = planRes.value;
      const outlookRes = computeJanuaryOutlook({
        plan: {
          year: plan.year,
          pool: plan.pool,
          reserveTarget: plan.reserve,
        },
        reserveLocked: plan.lockedReserve,
        baselines: {
          cells: [],
          novDec: { min: Money.zero(), avg: Money.zero(), max: Money.zero() },
        },
        spend: [],
        asOf: today,
      });
      if (outlookRes.ok) {
        outlook = outlookRes.value.payload;
      }
    }

    // Evaluate Guard
    const guardRes = evaluateThresholdGuard({
      item: {
        id: item.id,
        condition: item.condition,
        target: item.targetPrice,
        ceiling: item.ceilingPrice,
      },
      candidate: {
        price: candidatePrice,
        observedOn: today,
      },
      stats,
      policy: {
        lookbackYears: 5,
        warnBps: 500 as any,
        blockBps: 2000 as any,
        minSamples: 6,
      },
      outlook,
      asOf: today,
    });
    if (!guardRes.ok) return err(guardRes.error);
    const assessment = guardRes.value.payload;

    // Synthesize with AI
    const advisoryRes = await aiAdvisoryService.generateAdvisory({
      itemName: item.name,
      candidatePrice: candidatePrice.format(),
      stats,
      outlook,
      assessment,
    });

    const aiSummary = advisoryRes.ok ? advisoryRes.value.adviceMarkdown : "Guidance computed deterministically.";

    return ok({
      stats,
      outlook,
      assessment,
      aiAdvisory: aiSummary,
    });
  }
}

export const orchestrator = new CoreDecisionOrchestrator();
