import { describe, it, expect } from "vitest";
import { sanitizeZarPriceString, htmlPriceScraper } from "../../src/services/scrapers/html-scraper";
import { zarCurrencyService } from "../../src/services/currency/zar-currency";
import { saEconomicNewsService } from "../../src/services/rss/sa-economic-news";

describe("Part 3 Ingestion & Scrapers Test Suite", () => {
  describe("ZAR Price Sanitizer", () => {
    it("handles standard comma-thousands with point decimals", () => {
      const res = sanitizeZarPriceString("R 1,499.00");
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe("1499.00");
    });

    it("handles space-thousands with comma decimals (SA standard)", () => {
      const res = sanitizeZarPriceString("R 1 499,99");
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe("1499.99");
    });

    it("handles non-breaking spaces and ZAR prefix", () => {
      const res = sanitizeZarPriceString("ZAR\u00a012\u00a0450.50");
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe("12450.50");
    });

    it("handles integer prices without decimals", () => {
      const res = sanitizeZarPriceString("R899");
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe("899");
    });

    it("extracts price from marketing text", () => {
      const res = sanitizeZarPriceString("Special price: R 4,299.00 each");
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.value).toBe("4299.00");
    });
  });

  describe("HTML Price Scraper DOM Parsing", () => {
    it("extracts price from JSON-LD schema.org Product markup", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>PlayStation 5 Console | Takealot</title>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org/",
                "@type": "Product",
                "name": "PlayStation 5 Console",
                "offers": {
                  "@type": "Offer",
                  "priceCurrency": "ZAR",
                  "price": "11999.00",
                  "availability": "https://schema.org/InStock"
                }
              }
            </script>
          </head>
          <body>
            <div>Fallback DOM</div>
          </body>
        </html>
      `;

      const res = htmlPriceScraper.parseHtml(sampleHtml, "https://takealot.com/ps5", "Takealot");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.scrapedPrice.cents).toBe(1199900n);
        expect(res.value.storeName).toBe("Takealot");
      }
    });

    it("extracts price from OpenGraph meta tags", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Samsung 65 Inch TV | Makro</title>
            <meta property="product:price:amount" content="13999" />
            <meta property="product:price:currency" content="ZAR" />
          </head>
          <body></body>
        </html>
      `;

      const res = htmlPriceScraper.parseHtml(sampleHtml, "https://makro.co.za/tv", "Makro");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.scrapedPrice.cents).toBe(1399900n);
      }
    });

    it("extracts price from retail class selectors when no meta tags exist", () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>KitchenAid Mixer | Game</title></head>
          <body>
            <div class="current-price">R 8 499,00</div>
          </body>
        </html>
      `;

      const res = htmlPriceScraper.parseHtml(sampleHtml, "https://game.co.za/mixer", "Game");
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.scrapedPrice.cents).toBe(849900n);
      }
    });
  });

  describe("ZAR Currency Service", () => {
    it("returns a valid currency snapshot with spike calculation", async () => {
      const res = await zarCurrencyService.getExchangeRate();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.base).toBe("USD");
        expect(res.value.target).toBe("ZAR");
        expect(res.value.rate).toBeGreaterThan(10);
        expect(typeof res.value.spikeDetected).toBe("boolean");
        expect(typeof res.value.spikeBps).toBe("number");
      }
    });
  });

  describe("SA Economic News Service", () => {
    it("classifies inflationary and sentiment signals accurately", () => {
      expect(saEconomicNewsService.classifySentiment("SARB signals potential interest rate hike in MPC meeting")).toBe("INTEREST_RATE_HIKE");
      expect(saEconomicNewsService.classifySentiment("Food and fuel inflation pushes CPI higher")).toBe("INFLATIONARY_PRESSURE");
      expect(saEconomicNewsService.classifySentiment("Shoppers remain cautious amid high household debt")).toBe("CONSUMER_CONFIDENCE_LOW");
      expect(saEconomicNewsService.classifySentiment("Stable market conditions heading into fourth quarter")).toBe("NEUTRAL");
    });

    it("fetches macroeconomic feed articles", async () => {
      const res = await saEconomicNewsService.fetchMacroeconomicFeed();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.length).toBeGreaterThan(0);
        expect(res.value[0]?.sentimentSignal).toBeDefined();
      }
    });
  });
});
