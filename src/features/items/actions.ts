"use server";

import { createAction } from "../../lib/actions/create-action";
import { CreateItemSchema, LogPricePointSchema } from "../../domain/schemas";
import { itemRepository } from "../../repositories/item.repository";
import { pricePointRepository } from "../../repositories/price-point.repository";
import { Money } from "../../domain/money/money";
import { err } from "../../domain/errors/result";

export const createItemAction = createAction({
  name: "createItem",
  schema: CreateItemSchema,
  requireAuth: false, // permits guest demo flow with fallback user ID
  handler: async (input, ctx) => {
    const targetPrice = input.targetPrice ? Money.parse(input.targetPrice) : null;
    const ceilingPrice = input.ceilingPrice ? Money.parse(input.ceilingPrice) : null;

    if (targetPrice && !targetPrice.ok) return err(targetPrice.error);
    if (ceilingPrice && !ceilingPrice.ok) return err(ceilingPrice.error);

    return itemRepository.create(ctx.userId, {
      name: input.name,
      ...(input.category !== undefined ? { category: input.category } : {}),
      condition: input.condition,
      ...(targetPrice !== null ? { targetPrice: targetPrice.value } : {}),
      ...(ceilingPrice !== null ? { ceilingPrice: ceilingPrice.value } : {}),
    });
  },
});

export const logPricePointAction = createAction({
  name: "logPricePoint",
  schema: LogPricePointSchema,
  requireAuth: false,
  handler: async (input, ctx) => {
    const priceRes = Money.parse(input.price);
    if (!priceRes.ok) return err(priceRes.error);

    return pricePointRepository.insertMany(ctx.userId, input.itemId, [
      {
        observedOn: input.observedOn,
        price: priceRes.value,
        kind: input.kind,
        isAnomaly: input.isAnomaly,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    ]);
  },
});
