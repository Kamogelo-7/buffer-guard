import { NextRequest, NextResponse } from "next/server";
import { htmlPriceScraper } from "../../../../services/scrapers/html-scraper";
import { zarCurrencyService } from "../../../../services/currency/zar-currency";
import { z } from "zod";

const IngestPayloadSchema = z.object({
  url: z.string().url(),
  storeName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = IngestPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
    }

    const [scrapeRes, currencyRes] = await Promise.all([
      htmlPriceScraper.scrapeProductPrice(parsed.data.url, parsed.data.storeName),
      zarCurrencyService.getExchangeRate(),
    ]);

    return NextResponse.json({
      ok: true,
      priceResult: scrapeRes.ok ? scrapeRes.value : { error: scrapeRes.error.message },
      currencySnapshot: currencyRes.ok ? currencyRes.value : null,
    });
  } catch (e) {
    return NextResponse.json({ error: "Scraper ingestion failed", details: String(e) }, { status: 500 });
  }
}
