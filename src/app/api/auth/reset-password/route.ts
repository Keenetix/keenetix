import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    await resetPassword(token, password);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset your password." }, { status: 400 });
  }
}
