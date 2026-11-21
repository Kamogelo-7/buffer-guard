import { IsoDate } from "../../domain/types";

export interface Clock {
  now(): Date;
  todayIso(): IsoDate;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  todayIso(): IsoDate {
    const d = new Date();
    // Format YYYY-MM-DD in Africa/Johannesburg (UTC+2)
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d) as IsoDate;
  }
}

export class FrozenClock implements Clock {
  constructor(private readonly frozenIso: IsoDate) {}

  now(): Date {
    return new Date(`${this.frozenIso}T00:00:00+02:00`);
  }

  todayIso(): IsoDate {
    return this.frozenIso;
  }
}

export const defaultClock: Clock = new SystemClock();
