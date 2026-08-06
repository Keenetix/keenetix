import { NextResponse } from "next/server";
import { getCurrentIdentity, sendVerificationEmail } from "@/lib/auth";
import { appOrigin } from "@/lib/url";
export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (identity.emailVerified) return NextResponse.json({ ok: true });
  await sendVerificationEmail(identity.userId, identity.email, appOrigin(request));
  return NextResponse.json({ ok: true });
}
