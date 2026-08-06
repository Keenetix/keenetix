import { NextResponse } from "next/server";
import { getCurrentIdentity, getUserWorkspaces } from "@/lib/auth";
import { getDashboardData } from "@/lib/keenetix";
export async function GET() {
  const identity = await getCurrentIdentity();
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const [data, workspaces] = await Promise.all([getDashboardData(identity.workspaceId), getUserWorkspaces(identity.userId)]);
    return NextResponse.json({ ...data, identity, workspaces });
  } catch {
    return NextResponse.json({ error: "Unable to load the developer workspace." }, { status: 500 });
  }
}