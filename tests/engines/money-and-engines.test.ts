import { describe, it, expect } from "vitest";
import { Money, medianOf, meanOf, makeBps } from "../../src/domain/money/money";
import { computePriceStats } from "../../src/engines/price-stats";
import { computeJanuaryOutlook } from "../../src/engines/january-outlook";
import { PricePointInput, PromoWindowInput } from "../../src/domain/types";

describe("Domain: Money Primitive Invariants", () => {
  it("preserves exact integer cent arithmetic without floating point drift", () => {
    const p1 = Money.parse("1299.50");
    const p2 = Money.parse("700.50");
    expect(p1.ok).toBe(true);
    expect(p2.ok).toBe(true);

    if (p1.ok && p2.ok) {
      const sum = p1.value.add(p2.value);
      expect(sum.cents).toBe(200000n);
      expect(sum.format()).toBe("R 2,000.00");
    }
  });

  it("calculates basis points correctly", () => {
    const cost = Money.fromCents(100000n); // R 1,000.00
    const discounted = Money.fromCents(85000n); // R 850.00
    const diff = cost.sub(discounted); // R 150.00

    const ratio = diff.ratioBps(cost);
    expect(ratio.ok).toBe(true);
    if (ratio.ok) {
      expect(ratio.value).toBe(1500); // 15% discount
    }
  });

  it("computes exact median and mean", () => {
    const prices = [
      Money.fromCents(10000n),
      Money.fromCents(20000n),
      Money.fromCents(30000n),
    ];
    const med = medianOf(prices);
    const mean = meanOf(prices);
    expect(med.ok && med.value.cents).toBe(20000n);
    expect(mean.ok && mean.value.cents).toBe(20000n);
  });
});

describe("Engines: Price Stats & Black Friday Drops", () => {
  it("calculates Black Friday discount drops correctly", () => {
    const points: PricePointInput[] = [
      {
        id: "1",
        observedOn: "2024-05-10",
        price: Money.fromCents(100000n), // Normal price R 1,000.00
        kind: "REGULAR",
        isAnomaly: false,
        storeId: null,
      },
      {
        id: "2",
        observedOn: "2024-11-25",
        price: Money.fromCents(75000n), // BF price R 750.00 (25% drop)
        kind: "BLACK_FRIDAY",
        isAnomaly: false,
        storeId: null,
      },
    ];

    const windows: PromoWindowInput[] = [
      {
        kind: "BLACK_FRIDAY",
        year: 2024,
        startsOn: "2024-11-20",
        endsOn: "2024-11-30",
      },
    ];

    const res = computePriceStats({
      points,
      windows,
      asOf: "2026-11-22",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.payload.baseline.cents).toBe(100000n);
      expect(res.value.payload.blackFridayDrop.samples).toBe(1);
      expect(res.value.payload.blackFridayDrop.avgBps).toBe(2500); // 25.00%
    }
  });
});

describe("Engines: January Reserve Constraint", () => {
  it("flags BREACH when projected spend exceeds spendable pool", () => {
    const plan = {
      year: 2026,
      pool: Money.fromCents(2000000n), // R 20,000.00 total pool
      reserveTarget: Money.fromCents(1500000n), // R 15,000.00 locked January reserve
    };
    // Spendable = R 5,000.00
    const reserveLocked = Money.fromCents(1500000n);

    const outlook = computeJanuaryOutlook({
      plan,
      reserveLocked,
      baselines: {
        cells: [],
        novDec: {
          min: Money.fromCents(400000n),
          avg: Money.fromCents(800000n), // Avg expected spend R 8,000.00 > R 5,000.00
          max: Money.fromCents(1200000n),
        },
      },
      spend: [],
      asOf: "2026-11-01",
    });

    expect(outlook.ok).toBe(true);
    if (outlook.ok) {
      expect(outlook.value.payload.status).toBe("BREACH");
      expect(outlook.value.payload.spendable.cents).toBe(500000n);
    }
  });
});
