import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Used by the compose healthcheck and the CI smoke test. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", database: "down" }, { status: 503 });
  }
}
