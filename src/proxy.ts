import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function checkCsrf(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return null;
  const session = request.cookies.get("kntx_session")?.value;
  if (!session) return null;
  const csrfCookie = request.cookies.get("kntx_csrf")?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: "Invalid or missing CSRF token. Refresh the page and try again." }, { status: 403 });
  }
  return null;
}

const MARKETING_HOST = "www.keenetix.xyz";
const APP_HOST = "app.keenetix.xyz";

/** Pages that only ever run on the app host, however a visitor reaches them. */
const APP_PAGES = ["/dashboard", "/settlement", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/accept-invite"];

/**
 * Safety net for bookmarks, typed URLs, and stale links that land on the wrong
 * host. Same-host navigation (Link clicks within a page already on the right
 * host) never reaches this — see SiteHeader/SiteFooter's `variant` prop.
 */
function checkHostSplit(request: NextRequest) {
  const host = request.headers.get("host");
  const { pathname, search } = request.nextUrl;

  if (host === MARKETING_HOST && APP_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, `https://${APP_HOST}`), 308);
  }
  if (host === APP_HOST && pathname === "/") {
    return NextResponse.redirect(new URL(search, `https://${MARKETING_HOST}`), 308);
  }
  return null;
}

export function proxy(request: NextRequest) {
  return checkHostSplit(request) ?? checkCsrf(request) ?? NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/settlement/:path*", "/sign-in", "/sign-up", "/forgot-password/:path*", "/reset-password/:path*", "/accept-invite/:path*", "/"],
};
