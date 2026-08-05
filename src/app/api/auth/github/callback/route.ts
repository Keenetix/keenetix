import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signInWithOAuth } from "@/lib/auth";
import { appOrigin, oauthCookieNames, resolveGithubProfile } from "@/lib/oauth";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const { state: stateCookie, next: nextCookie } = oauthCookieNames();
  const expectedState = store.get(stateCookie)?.value;
  const next = store.get(nextCookie)?.value;
  store.delete(stateCookie);
  store.delete(nextCookie);
  const failure = (message: string) => NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(message)}`, origin));
  if (!code || !state || !expectedState || state !== expectedState) return failure("The sign-in request expired or was tampered with. Try again.");
  try {
    const profile = await resolveGithubProfile(code, `${origin}/api/auth/github/callback`);
    await signInWithOAuth({ provider: "github", providerAccountId: profile.providerAccountId, email: profile.email, name: profile.name });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Unable to sign in with GitHub.");
  }
  return NextResponse.redirect(new URL(next?.startsWith("/") ? next : "/dashboard", origin));
}
