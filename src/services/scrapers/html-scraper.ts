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
 * Extracts and normalizes a monetary string from various South African retail formats:
 * e.g., "R 1,499.00", "R1 499,99", "ZAR 1499", "1 499.50", "R14,999"
 */
export function sanitizeZarPriceString(raw: string): Result<string> {
  // Normalize whitespace (including non-breaking spaces \u00a0)
  let cleaned = raw.replace(/[\u00a0\s]+/g, " ").trim();

  // Remove currency markers "ZAR", "R", and common trailing noise
  cleaned = cleaned.replace(/^(ZAR|R)\s*/i, "").trim();

  // Match standard patterns
  // Pattern 1: Comma as thousand separator, period as decimal: "1,499.99" or "14,999"
  if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  }
  // Pattern 2: Space as thousand separator, comma or period as decimal: "1 499,99" or "1 499.99"
  else if (/^\d{1,3}(\s\d{3})*([.,]\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\s/g, "").replace(",", ".");
  }
  // Pattern 3: Simple integer or single decimal: "1499" or "1499.99" or "1499,99"
  else if (/^\d+([.,]\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  } else {
    // Attempt greedy extraction of first currency-like pattern: e.g. "Now R 1,299.00 each"
    const match = cleaned.match(/(\d[\d\s,.]*\d|\d+)/);
    if (!match || !match[1]) {
      return err(new AppError("VALIDATION_FAILED", `Cannot parse monetary value from: "${raw}"`));
    }
    return sanitizeZarPriceString(match[1]);
  }

  // Ensure two decimal places or whole number
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return err(new AppError("VALIDATION_FAILED", `Sanitized price is not a valid decimal: "${cleaned}"`));
  }

  return ok(cleaned);
}

/**
 * Background utility to scrape retailer HTML pages (Takealot, Makro, Game, Incredible Connection, etc.)
 * Extracts structured price data via JSON-LD, OpenGraph/meta tags, or DOM selectors.
 */
export class HtmlPriceScraper {
  /**
   * Parses HTML string directly (testable without live HTTP).
   */
  parseHtml(html: string, url: string, storeName: string): Result<ScrapedPricePoint> {
    try {
      const $ = cheerio.load(html);

      let priceText: string | undefined;

      // 1. Try JSON-LD structured data (Product Schema)
      $('script[type="application/ld+json"]').each((_, el) => {
        if (priceText) return;
        try {
          const content = $(el).html();
          if (!content) return;
          const json = JSON.parse(content);
          const items = Array.isArray(json) ? json : [json];
          for (const item of items) {
            if (item["@type"] === "Product" && item.offers) {
              const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
              if (offers && offers.price) {
                priceText = String(offers.price);
                break;
              }
            }
          }
        } catch {
          // Continue to next tag
        }
      });

      // 2. OpenGraph / meta properties
      if (!priceText) {
        priceText =
          $('meta[property="product:price:amount"]').attr("content") ||
          $('meta[property="og:price:amount"]').attr("content") ||
          $('meta[name="twitter:data1"]').attr("content") ||
          $('meta[itemprop="price"]').attr("content");
      }

      // 3. Common SA Retailer DOM selectors
      if (!priceText) {
        priceText =
          $('[data-testid="price"]').first().text() ||
          $(".currency-plus-price").first().text() ||
          $(".pdp-price").first().text() ||
          $(".current-price").first().text() ||
          $(".price, .amount").first().text();
      }

      if (!priceText || !priceText.trim()) {
        return err(new AppError("NOT_FOUND", `Could not locate price selector in HTML for ${url}`));
      }

      const sanitized = sanitizeZarPriceString(priceText);
      if (!sanitized.ok) {
        return err(sanitized.error);
      }

      const parsedMoney = Money.parse(sanitized.value);
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
      return err(new AppError("UNEXPECTED", `Failed to parse product HTML for ${url}`, false, e));
    }
  }

  async scrapeProductPrice(url: string, storeName: string): Promise<Result<ScrapedPricePoint>> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BufferGuard/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-ZA,en-GB;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        return err(
          new AppError("UNEXPECTED", `Retailer returned HTTP ${response.status} when scraping ${url}`, true)
        );
      }

      const html = await response.text();
      return this.parseHtml(html, url, storeName);
    } catch (e) {
      return err(new AppError("UNEXPECTED", `Failed to scrape price from ${url}`, true, e));
    }
  }
}

export const htmlPriceScraper = new HtmlPriceScraper();
