import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/auth";
import { getDashboardData } from "@/lib/keenetix";
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return NextResponse.json({ ...(await getDashboardData(identity.workspaceId)), identity });
  } catch {
    return NextResponse.json({ error: "Unable to load the developer workspace." }, { status: 500 });
  }
}