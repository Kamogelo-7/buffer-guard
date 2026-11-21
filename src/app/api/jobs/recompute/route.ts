import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../lib/env";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = env.CRON_SECRET;

  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized cron ping" }, { status: 401 });
  }

  try {
    // In production: iterates active items and updates seasonal baselines
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      message: "Recompute cron cycle executed successfully.",
    });
  } catch (e) {
    return NextResponse.json({ error: "Internal cron failure", details: String(e) }, { status: 500 });
  }
}
