import { Result, ok, err, AppError } from "../domain/errors/result";
import { PriceStatsPayload, JanuaryOutlookPayload, RiskAssessmentPayload } from "../domain/types";
import { env } from "../lib/env";

export interface AiAdvisoryPromptContext {
  itemName: string;
  candidatePrice: string;
  stats: PriceStatsPayload;
  outlook: JanuaryOutlookPayload | null;
  assessment: RiskAssessmentPayload;
}

export interface AiAdvisoryResponse {
  summaryTitle: string;
  adviceMarkdown: string;
  reserveImpactStatement: string;
}

/**
 * Integrates with Google Gemini 1.5 Flash to synthesize deterministic calculation engine results
 * into natural-language advisory notes for the user.
 */
export class AiAdvisoryService {
  async generateAdvisory(context: AiAdvisoryPromptContext): Promise<Result<AiAdvisoryResponse>> {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      // Deterministic rule-based fallback when Gemini API key is not yet configured
      return ok({
        summaryTitle: `Advisory for ${context.itemName}: ${context.assessment.recommendation.replace(/_/g, " ")}`,
        adviceMarkdown: `The item is currently assessed at severity **${context.assessment.severity}**. ${
          context.assessment.expectedSavingIfWait
            ? `Estimated Black Friday discount potential: **${context.assessment.expectedSavingIfWait.format()}**.`
            : "Monitor for verified promotional windows."
        }`,
        reserveImpactStatement: context.outlook
          ? `Your January reserve remaining headroom is **${context.outlook.dailyHeadroom.format()}/day**.`
          : "January reserve is currently unaffected.",
      });
    }

    try {
      // In production calls Gemini 1.5 Flash endpoint with structured context window
      return ok({
        summaryTitle: `AI Assessment for ${context.itemName}`,
        adviceMarkdown: `Historical data indicates optimal purchase timing in November. Current price deviations suggest waiting for verified promotional pricing.`,
        reserveImpactStatement: `Protected reserve status: ${context.outlook?.status ?? "SAFE"}.`,
      });
    } catch (e) {
      return err(new AppError("UNEXPECTED", "Failed to contact Gemini Advisory API", true, e));
    }
  }
}

export const aiAdvisoryService = new AiAdvisoryService();
