import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { buildGoogleAuthUrl, oauthCookieNames } from "@/lib/oauth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const state = randomBytes(16).toString("hex");
  let authUrl: string;
  try {
    authUrl = buildGoogleAuthUrl(`${url.origin}/api/auth/google/callback`, state);
  } catch (error) {
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error instanceof Error ? error.message : "Google sign-in is not configured.")}`, url.origin));
  }
  const response = NextResponse.redirect(authUrl);
  const { state: stateCookie, next: nextCookie } = oauthCookieNames();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  response.cookies.set(stateCookie, state, options);
  if (next?.startsWith("/")) response.cookies.set(nextCookie, next, options);
  return response;
}
