import { NextResponse, type NextRequest } from "next/server";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export function proxy(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return NextResponse.next();
  const session = request.cookies.get("kntx_session")?.value;
  if (!session) return NextResponse.next();
  const csrfCookie = request.cookies.get("kntx_csrf")?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return NextResponse.json({ error: "Invalid or missing CSRF token. Refresh the page and try again." }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: "/api/:path*" };
