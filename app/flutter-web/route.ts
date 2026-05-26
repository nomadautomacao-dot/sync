import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const htmlPath = path.join(process.cwd(), "public", "flutter-web", "index.html");
  if (!existsSync(htmlPath)) {
    return NextResponse.json({ error: "Flutter web not found" }, { status: 404 });
  }
  const html = readFileSync(htmlPath, "utf-8");
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
