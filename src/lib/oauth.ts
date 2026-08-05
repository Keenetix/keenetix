const STATE_COOKIE = "kntx_oauth_state";
const NEXT_COOKIE = "kntx_oauth_next";

export type OAuthProfile = { providerAccountId: string; email: string; name: string };

export function oauthCookieNames() {
  return { state: STATE_COOKIE, next: NEXT_COOKIE };
}

export function appOrigin(request: Request) {
  return process.env.APP_URL ?? new URL(request.url).origin;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured.");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function resolveGoogleProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google sign-in is not configured.");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!tokenResponse.ok) throw new Error("Google rejected the sign-in request.");
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Google did not return an access token.");
  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  if (!userResponse.ok) throw new Error("Unable to load your Google profile.");
  const profile = await userResponse.json() as { sub?: string; email?: string; name?: string };
  if (!profile.sub || !profile.email) throw new Error("Google did not provide the required profile fields.");
  return { providerAccountId: profile.sub, email: profile.email, name: profile.name ?? profile.email };
}

export function buildGithubAuthUrl(redirectUri: string, state: string) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_OAUTH_CLIENT_ID is not configured.");
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "read:user user:email", state });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function resolveGithubProfile(code: string, redirectUri: string): Promise<OAuthProfile> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GitHub sign-in is not configured.");
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
  });
  if (!tokenResponse.ok) throw new Error("GitHub rejected the sign-in request.");
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error("GitHub did not return an access token.");
  const headers = { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "keenetix", Accept: "application/vnd.github+json" };
  const userResponse = await fetch("https://api.github.com/user", { headers });
  if (!userResponse.ok) throw new Error("Unable to load your GitHub profile.");
  const profile = await userResponse.json() as { id?: number; email?: string | null; name?: string | null; login?: string };
  if (!profile.id) throw new Error("GitHub did not provide the required profile fields.");
  let email = profile.email ?? "";
  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", { headers });
    if (emailsResponse.ok) {
      const emails = await emailsResponse.json() as { email: string; primary: boolean; verified: boolean }[];
      email = emails.find((entry) => entry.primary && entry.verified)?.email ?? emails.find((entry) => entry.verified)?.email ?? "";
    }
  }
  if (!email) throw new Error("Your GitHub account has no verified email address to sign in with.");
  return { providerAccountId: String(profile.id), email, name: profile.name ?? profile.login ?? email };
}
