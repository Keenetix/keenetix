import { NextResponse } from "next/server";
import { signUp } from "@/lib/auth";
import { appOrigin } from "@/lib/url";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; password?: unknown; organization?: unknown };
    const name = typeof body.name === "string" ? body.name : "";
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const organization = typeof body.organization === "string" ? body.organization : "";
    await signUp({ name, email, password, organization, origin: appOrigin(request) });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create your workspace." }, { status: 400 });
  }
}
