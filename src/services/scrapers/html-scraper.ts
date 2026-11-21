import * as cheerio from "cheerio";
import { Money } from "../../domain/money/money";
import { Result, ok, err, AppError } from "../../domain/errors/result";
import { IsoDate } from "../../domain/types";

export interface ScrapedPricePoint {
  storeName: string;
  url: string;
  scrapedPrice: Money;
  observedOn: IsoDate;
  rawTitle: string;
}

/**
 * Background utility to scrape retailer HTML pages (Takealot, Makro, Game, etc.)
 * Extracts price nodes and validates numerical currency values.
 */
export class HtmlPriceScraper {
  async scrapeProductPrice(url: string, storeName: string): Promise<Result<ScrapedPricePoint>> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "BufferGuardBot/1.0 (+https://bufferguard.app/bot)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (!response.ok) {
        return err(
          new AppError("UNEXPECTED", `Retailer returned HTTP ${response.status} when scraping ${url}`, true)
        );
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract price string from common SA retail selectors or meta tags
      let priceText =
        $('meta[property="product:price:amount"]').attr("content") ||
        $('meta[property="og:price:amount"]').attr("content") ||
        $('[data-testid="price"]').first().text() ||
        $(".currency-plus-price").first().text() ||
        $(".price, .current-price, .amount").first().text();

      if (!priceText) {
        return err(new AppError("NOT_FOUND", `Could not locate price selector in HTML for ${url}`));
      }

      // Sanitize: "R 1,499.00" -> "1499.00"
      priceText = priceText.replace(/[R\s,]/g, (match) => (match === "," ? "" : ""));
      const parsedMoney = Money.parse(priceText);
      if (!parsedMoney.ok) {
        return err(parsedMoney.error);
      }

      const rawTitle = $("title").text().trim() || storeName;
      const today = new Date().toISOString().split("T")[0] as IsoDate;

      return ok({
        storeName,
        url,
        scrapedPrice: parsedMoney.value,
        observedOn: today,
        rawTitle,
      });
    } catch (e) {
      return err(new AppError("UNEXPECTED", `Failed to scrape price from ${url}`, true, e));
    }
  }
}

export const htmlPriceScraper = new HtmlPriceScraper();
