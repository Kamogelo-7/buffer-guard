import { prisma } from "../lib/db/prisma";
import { Result, ok, err, AppError } from "../domain/errors/result";
import { Money } from "../domain/money/money";
import { PricePointInput, PriceKind, IsoDate } from "../domain/types";

export interface NewPricePointRow {
  storeId?: string | null;
  observedOn: IsoDate;
  price: Money;
  kind?: PriceKind;
  isAnomaly?: boolean;
  note?: string;
}

export class PricePointRepository {
  async listForItem(
    userId: string,
    itemId: string,
    options?: { since?: IsoDate }
  ): Promise<Result<readonly PricePointInput[]>> {
    try {
      // First verify item ownership
      const item = await prisma.item.findFirst({
        where: { id: itemId, userId },
        select: { id: true },
      });
      if (!item) {
        return err(new AppError("NOT_FOUND", "Item not found or forbidden"));
      }

      const rows = await prisma.pricePoint.findMany({
        where: {
          itemId,
          ...(options?.since ? { observedOn: { gte: new Date(options.since) } } : {}),
        },
        orderBy: { observedOn: "asc" },
      });

      const points: PricePointInput[] = rows.map((r) => ({
        id: r.id,
        observedOn: r.observedOn.toISOString().split("T")[0] as IsoDate,
        price: Money.fromCents(r.priceCents),
        kind: r.kind as PriceKind,
        isAnomaly: r.isAnomaly,
        storeId: r.storeId,
      }));

      return ok(points);
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to list price points", true, e));
    }
  }

  async insertMany(
    userId: string,
    itemId: string,
    rows: readonly NewPricePointRow[]
  ): Promise<Result<{ inserted: number; skipped: number }>> {
    try {
      const item = await prisma.item.findFirst({
        where: { id: itemId, userId },
      });
      if (!item) {
        return err(new AppError("NOT_FOUND", "Item not found"));
      }

      let inserted = 0;
      let skipped = 0;

      for (const row of rows) {
        try {
          await prisma.pricePoint.create({
            data: {
              itemId,
              storeId: row.storeId ?? null,
              observedOn: new Date(row.observedOn),
              priceCents: row.price.cents,
              kind: row.kind ?? "REGULAR",
              isAnomaly: row.isAnomaly ?? false,
              note: row.note ?? null,
            },
          });
          inserted++;
        } catch {
          // Unique constraint conflict skips duplicate observation
          skipped++;
        }
      }

      return ok({ inserted, skipped });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to insert price points batch", true, e));
    }
  }
}

export const pricePointRepository = new PricePointRepository();
