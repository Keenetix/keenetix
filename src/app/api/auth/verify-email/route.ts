import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth";
import { appOrigin } from "@/lib/url";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(request);
  const token = url.searchParams.get("token") ?? "";
  try {
    await verifyEmailToken(token);
  } catch (error) {
    return NextResponse.redirect(new URL(`/dashboard?verifyError=${encodeURIComponent(error instanceof Error ? error.message : "Unable to verify your email.")}`, origin));
  }
  return NextResponse.redirect(new URL("/dashboard?verified=1", origin));
}
