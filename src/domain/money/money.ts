import { Result, ok, err, AppError } from "../errors/result";

export type RoundingMode = "HALF_EVEN" | "HALF_UP" | "FLOOR" | "CEIL";

declare const bpsBrand: unique symbol;
export type Bps = number & { readonly [bpsBrand]: true };

export function makeBps(n: number): Bps {
  return Math.round(n) as Bps;
}

export interface MoneyDTO {
  readonly cents: string;
  readonly currency: "ZAR";
}

/**
 * Money primitive guaranteeing zero floating-point arithmetic.
 * Internally stores value as BigInt cents (ZAR).
 */
export class Money {
  private constructor(readonly cents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(cents: bigint): Money {
    return new Money(cents);
  }

  static parse(decimalStr: string): Result<Money> {
    const trimmed = decimalStr.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
      return err(
        new AppError(
          "VALIDATION_FAILED",
          `Invalid monetary format: "${decimalStr}". Expected standard decimal (e.g. 1299.50)`
        )
      );
    }

    const isNegative = trimmed.startsWith("-");
    const clean = isNegative ? trimmed.slice(1) : trimmed;
    const [wholePart = "0", fractionPart = ""] = clean.split(".");
    const paddedFraction = (fractionPart + "00").slice(0, 2);

    try {
      const wholeCents = BigInt(wholePart) * 100n;
      const fracCents = BigInt(paddedFraction);
      const total = wholeCents + fracCents;
      return ok(new Money(isNegative ? -total : total));
    } catch (e) {
      return err(new AppError("VALIDATION_FAILED", "Failed to parse monetary integer", false, e));
    }
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  sub(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  mulBps(bps: Bps, mode: RoundingMode = "HALF_EVEN"): Money {
    const numerator = this.cents * BigInt(bps);
    const denominator = 10000n;
    return new Money(roundDivision(numerator, denominator, mode));
  }

  divInt(divisor: number, mode: RoundingMode = "HALF_EVEN"): Result<Money> {
    if (divisor === 0) {
      return err(new AppError("ENGINE_INVARIANT", "Division by zero in Money.divInt"));
    }
    const d = BigInt(divisor);
    return ok(new Money(roundDivision(this.cents, d, mode)));
  }

  ratioBps(denominator: Money, mode: RoundingMode = "HALF_EVEN"): Result<Bps> {
    if (denominator.cents === 0n) {
      return err(new AppError("ENGINE_INVARIANT", "Denominator cannot be zero in ratioBps"));
    }
    const numerator = this.cents * 10000n;
    const rounded = roundDivision(numerator, denominator.cents, mode);
    return ok(Number(rounded) as Bps);
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.cents < other.cents) return -1;
    if (this.cents > other.cents) return 1;
    return 0;
  }

  toDTO(): MoneyDTO {
    return {
      cents: this.cents.toString(),
      currency: "ZAR",
    };
  }

  format(): string {
    const isNegative = this.cents < 0n;
    const abs = isNegative ? -this.cents : this.cents;
    const rands = abs / 100n;
    const cents = abs % 100n;
    const paddedCents = cents.toString().padStart(2, "0");
    return `${isNegative ? "-" : ""}R ${rands.toLocaleString("en-ZA")}.${paddedCents}`;
  }
}

function roundDivision(num: bigint, den: bigint, mode: RoundingMode): bigint {
  const isNegative = (num < 0n) !== (den < 0n);
  const a = num < 0n ? -num : num;
  const b = den < 0n ? -den : den;

  const quotient = a / b;
  const remainder = a % b;

  if (remainder === 0n) {
    return isNegative ? -quotient : quotient;
  }

  let increment = false;

  switch (mode) {
    case "FLOOR":
      increment = isNegative;
      break;
    case "CEIL":
      increment = !isNegative;
      break;
    case "HALF_UP":
      increment = remainder * 2n >= b;
      break;
    case "HALF_EVEN": {
      const doubleRemainder = remainder * 2n;
      if (doubleRemainder > b) {
        increment = true;
      } else if (doubleRemainder === b) {
        increment = quotient % 2n !== 0n;
      }
      break;
    }
  }

  const result = increment ? quotient + 1n : quotient;
  return isNegative ? -result : result;
}

export function sum(values: readonly Money[]): Money {
  let total = 0n;
  for (const v of values) {
    total += v.cents;
  }
  return new Money(total);
}

export function medianOf(values: readonly Money[]): Result<Money> {
  if (values.length === 0) {
    return err(new AppError("INSUFFICIENT_DATA", "Cannot compute median of empty set"));
  }
  const sorted = [...values].sort((a, b) => (a.cents < b.cents ? -1 : a.cents > b.cents ? 1 : 0));
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return ok(sorted[mid]!);
  }
  const low = sorted[mid - 1]!;
  const high = sorted[mid]!;
  return ok(new Money((low.cents + high.cents) / 2n));
}

export function meanOf(values: readonly Money[], mode: RoundingMode = "HALF_EVEN"): Result<Money> {
  if (values.length === 0) {
    return err(new AppError("INSUFFICIENT_DATA", "Cannot compute mean of empty set"));
  }
  return sum(values).divInt(values.length, mode);
}
