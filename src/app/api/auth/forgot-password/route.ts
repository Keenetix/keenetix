import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";
import { appOrigin } from "@/lib/url";
export async function POST(request: Request) {
  const body = await request.json() as { email?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  if (email) await requestPasswordReset(email, appOrigin(request));
  return NextResponse.json({ ok: true });
}
