import { prisma } from "../lib/db/prisma";
import { Result, ok, err, AppError } from "../domain/errors/result";
import { Money } from "../domain/money/money";
import { ItemCondition, ItemStatus } from "../domain/types";

export interface ItemEntity {
  id: string;
  userId: string;
  name: string;
  category: string | null;
  condition: ItemCondition;
  targetPrice: Money | null;
  ceilingPrice: Money | null;
  status: ItemStatus;
  createdAt: Date;
}

export class ItemRepository {
  async listByUser(userId: string): Promise<Result<readonly ItemEntity[]>> {
    try {
      const rows = await prisma.item.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      const items: ItemEntity[] = rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        category: r.category,
        condition: r.condition as ItemCondition,
        targetPrice: r.targetCents !== null ? Money.fromCents(r.targetCents) : null,
        ceilingPrice: r.ceilingCents !== null ? Money.fromCents(r.ceilingCents) : null,
        status: r.status as ItemStatus,
        createdAt: r.createdAt,
      }));

      return ok(items);
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to query user items", true, e));
    }
  }

  async getById(userId: string, itemId: string): Promise<Result<ItemEntity>> {
    try {
      const row = await prisma.item.findFirst({
        where: { id: itemId, userId },
      });
      if (!row) {
        return err(new AppError("NOT_FOUND", `Item with ID ${itemId} not found for this user.`));
      }
      return ok({
        id: row.id,
        userId: row.userId,
        name: row.name,
        category: row.category,
        condition: row.condition as ItemCondition,
        targetPrice: row.targetCents !== null ? Money.fromCents(row.targetCents) : null,
        ceilingPrice: row.ceilingCents !== null ? Money.fromCents(row.ceilingCents) : null,
        status: row.status as ItemStatus,
        createdAt: row.createdAt,
      });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to fetch item", true, e));
    }
  }

  async create(
    userId: string,
    data: {
      name: string;
      category?: string;
      condition?: ItemCondition;
      targetPrice?: Money;
      ceilingPrice?: Money;
    }
  ): Promise<Result<ItemEntity>> {
    try {
      const created = await prisma.item.create({
        data: {
          userId,
          name: data.name,
          category: data.category ?? null,
          condition: data.condition ?? "NEW",
          targetCents: data.targetPrice ? data.targetPrice.cents : null,
          ceilingCents: data.ceilingPrice ? data.ceilingPrice.cents : null,
          status: "TRACKING",
        },
      });

      return ok({
        id: created.id,
        userId: created.userId,
        name: created.name,
        category: created.category,
        condition: created.condition as ItemCondition,
        targetPrice: created.targetCents !== null ? Money.fromCents(created.targetCents) : null,
        ceilingPrice: created.ceilingCents !== null ? Money.fromCents(created.ceilingCents) : null,
        status: created.status as ItemStatus,
        createdAt: created.createdAt,
      });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to create item", true, e));
    }
  }
}

export const itemRepository = new ItemRepository();
