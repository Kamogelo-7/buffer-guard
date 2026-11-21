import { prisma } from "../lib/db/prisma";
import { Result, ok, err, AppError } from "../domain/errors/result";
import { EngineKind } from "../domain/types";
import { Prisma } from "@prisma/client";

export class EngineRunRepository {
  async getCachedRun<T>(
    userId: string,
    kind: EngineKind,
    subjectKey: string,
    inputHash: string,
    engineVersion: string
  ): Promise<Result<T | null>> {
    try {
      const run = await prisma.engineRun.findUnique({
        where: {
          userId_kind_subjectKey_inputHash_engineVersion: {
            userId,
            kind,
            subjectKey,
            inputHash,
            engineVersion,
          },
        },
      });

      if (!run) return ok(null);
      return ok(run.output as T);
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to read engine run cache", true, e));
    }
  }

  async persistRun<T>(
    userId: string,
    kind: EngineKind,
    subjectKey: string,
    inputHash: string,
    engineVersion: string,
    output: T
  ): Promise<Result<{ id: string }>> {
    try {
      const created = await prisma.engineRun.upsert({
        where: {
          userId_kind_subjectKey_inputHash_engineVersion: {
            userId,
            kind,
            subjectKey,
            inputHash,
            engineVersion,
          },
        },
        update: {
          output: output as unknown as Prisma.InputJsonValue,
          computedAt: new Date(),
        },
        create: {
          userId,
          kind,
          subjectKey,
          inputHash,
          engineVersion,
          output: output as unknown as Prisma.InputJsonValue,
        },
      });

      return ok({ id: created.id });
    } catch (e) {
      return err(new AppError("DB_UNAVAILABLE", "Failed to persist engine run", true, e));
    }
  }
}

export const engineRunRepository = new EngineRunRepository();
