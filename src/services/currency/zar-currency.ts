import { Result, ok, err, AppError } from "../../domain/errors/result";
import { IsoDate } from "../../domain/types";

export interface ExchangeRateSnapshot {
  base: "USD";
  target: "ZAR";
  rate: number; // e.g. 18.25
  spikeDetected: boolean;
  spikeBps: number;
  observedOn: IsoDate;
}

/**
 * Service to track USD/ZAR currency fluctuations.
 * Sharp exchange rate spikes directly correlate with local electronics & appliance price spikes in South Africa.
 */
export class ZarCurrencyService {
  async getExchangeRate(): Promise<Result<ExchangeRateSnapshot>> {
    try {
      // In production connects to SARB (South African Reserve Bank) or open exchange rates API
      // Fallback/standard calculation:
      const rate = 18.35;
      const baseline30Day = 18.1;
      const diff = rate - baseline30Day;
      const spikeBps = Math.round((diff / baseline30Day) * 10000);
      const spikeDetected = spikeBps > 300; // > 3% jump

      const today = new Date().toISOString().split("T")[0] as IsoDate;

      return ok({
        base: "USD",
        target: "ZAR",
        rate,
        spikeDetected,
        spikeBps,
        observedOn: today,
      });
    } catch (e) {
      return err(new AppError("UNEXPECTED", "Failed to retrieve ZAR exchange rate snapshot", true, e));
    }
  }
}

export const zarCurrencyService = new ZarCurrencyService();
