import { NextResponse } from "next/server";
import { advanceDemo, getDemoData, type DemoAction } from "@/lib/keenetix";

const actions = new Set<DemoAction>(["fund", "assign", "verify", "settle", "reset"]);

export async function GET() {
  try {
    return NextResponse.json(await getDemoData());
  } catch {
    return NextResponse.json({ error: "Unable to load the demo commitment." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: unknown };
    if (typeof body.action !== "string" || !actions.has(body.action as DemoAction)) {
      return NextResponse.json({ error: "Unsupported demo action." }, { status: 400 });
    }
    return NextResponse.json(await advanceDemo(body.action as DemoAction));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the demo commitment.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
