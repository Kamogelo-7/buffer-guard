import { itemRepository } from "../../repositories/item.repository";
import { pricePointRepository } from "../../repositories/price-point.repository";
import { budgetPlanRepository } from "../../repositories/budget-plan.repository";

export async function fetchUserDashboardData(userId: string) {
  const [itemsRes, planRes] = await Promise.all([
    itemRepository.listByUser(userId),
    budgetPlanRepository.getByYear(userId, 2026),
  ]);

  return {
    items: itemsRes.ok ? itemsRes.value : [],
    plan: planRes.ok ? planRes.value : null,
  };
}

export async function fetchItemPriceHistory(userId: string, itemId: string) {
  return pricePointRepository.listForItem(userId, itemId);
}
