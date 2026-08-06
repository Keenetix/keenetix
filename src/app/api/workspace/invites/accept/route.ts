import { NextResponse } from "next/server";
import { acceptInvite, getInviteDetails } from "@/lib/auth";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const invite = await getInviteDetails(token);
  if (!invite) return NextResponse.json({ error: "This invite is invalid or has expired." }, { status: 404 });
  return NextResponse.json({ invite });
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as { token?: unknown; name?: unknown; password?: unknown };
    const token = typeof body.token === "string" ? body.token : "";
    const name = typeof body.name === "string" ? body.name : undefined;
    const password = typeof body.password === "string" ? body.password : undefined;
    await acceptInvite({ token, name, password });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept this invite." }, { status: 400 });
  }
}
