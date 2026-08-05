import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessRequests } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; email?: unknown; focus?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const focus = typeof body.focus === "string" ? body.focus.trim() : "";

    if (!name || !email || !focus || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Please provide a name, valid email, and project focus." }, { status: 400 });
    }

    await db.insert(accessRequests).values({ name, email, focus });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "We could not save your request. Please try again." }, { status: 500 });
  }
}
