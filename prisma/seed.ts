import { PrismaClient, PromoKind } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding promotional windows (South Africa Black Friday)...");

  const promoWindows = [
    { kind: PromoKind.BLACK_FRIDAY, year: 2020, startsOn: new Date("2020-11-20"), endsOn: new Date("2020-11-30") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2021, startsOn: new Date("2021-11-19"), endsOn: new Date("2021-11-29") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2022, startsOn: new Date("2022-11-18"), endsOn: new Date("2022-11-28") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2023, startsOn: new Date("2023-11-17"), endsOn: new Date("2023-11-27") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2024, startsOn: new Date("2024-11-22"), endsOn: new Date("2024-12-02") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2025, startsOn: new Date("2025-11-21"), endsOn: new Date("2025-12-01") },
    { kind: PromoKind.BLACK_FRIDAY, year: 2026, startsOn: new Date("2026-11-20"), endsOn: new Date("2026-11-30") },
  ];

  for (const window of promoWindows) {
    await prisma.promoWindow.upsert({
      where: {
        kind_year: {
          kind: window.kind,
          year: window.year,
        },
      },
      update: {},
      create: window,
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
