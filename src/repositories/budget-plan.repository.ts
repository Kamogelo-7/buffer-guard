import { prisma } from "../lib/db/prisma";
import { Result, ok, err, AppError } from "../domain/errors/result";
import { Money } from "../domain/money/money";
import { PlanStatus, ReserveEventType } from "../domain/types";

export interface BudgetPlanEntity {
  id: string;
  userId: string;
  year: number;
  status: PlanStatus;
  pool: Money;
  reserve: Money;
  lockedReserve: Money;
  createdAt: Date;
}

export class BudgetPlanRepository {
  async getByYear(userId: string, year: number): Promise<Result<BudgetPlanEntity | null>> {
    try {
      const plan = await prisma.budgetPlan.findUnique({
        where: {
          userId_year: { userId, year },
        },
        include: {
          ledger: true,
        },
      });

      if (!plan) return ok(null);

      // Reserve balance = sum of ledger deltas
      let lockedCents = 0n;
      for (const entry of plan.ledger) {
        lockedCents += entry.deltaCents;
      }

      return ok({
        id: plan.id,
        userId: plan.userId,
        year: plan.year,
        status: plan.status as PlanStatus,
        pool: Money.fromCents(plan.poolCents),
        reserve: Money.fromCents(plan.reserveCents),
        lockedReserve: Money.fromCents(lockedCents),
        createdAt: plan.createdAt,
      });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to fetch budget plan", true, e));
    }
  }

  async createPlan(
    userId: string,
    data: {
      year: number;
      pool: Money;
      reserve: Money;
    }
  ): Promise<Result<BudgetPlanEntity>> {
    try {
      const plan = await prisma.budgetPlan.create({
        data: {
          userId,
          year: data.year,
          poolCents: data.pool.cents,
          reserveCents: data.reserve.cents,
          status: "ACTIVE",
          ledger: {
            create: {
              type: "LOCK",
              deltaCents: data.reserve.cents,
              reason: "Initial January Reserve Lock",
            },
          },
        },
      });

      return ok({
        id: plan.id,
        userId: plan.userId,
        year: plan.year,
        status: plan.status as PlanStatus,
        pool: Money.fromCents(plan.poolCents),
        reserve: Money.fromCents(plan.reserveCents),
        lockedReserve: Money.fromCents(plan.reserveCents),
        createdAt: plan.createdAt,
      });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to create budget plan and reserve lock", true, e));
    }
  }

  async appendReserveLedger(
    userId: string,
    planId: string,
    entry: {
      type: ReserveEventType;
      delta: Money;
      reason?: string;
      availableAt?: Date;
    }
  ): Promise<Result<{ id: string }>> {
    try {
      const plan = await prisma.budgetPlan.findFirst({
        where: { id: planId, userId },
      });
      if (!plan) {
        return err(new AppError("NOT_FOUND", "Budget plan not found"));
      }

      const created = await prisma.reserveLedgerEntry.create({
        data: {
          planId,
          type: entry.type,
          deltaCents: entry.delta.cents,
          reason: entry.reason ?? null,
          availableAt: entry.availableAt ?? null,
        },
      });

      return ok({ id: created.id });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to append to immutable reserve ledger", true, e));
    }
  }
}

export const budgetPlanRepository = new BudgetPlanRepository();
