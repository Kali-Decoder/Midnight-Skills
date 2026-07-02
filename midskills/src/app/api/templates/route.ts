import { NextResponse } from "next/server";
import { getTemplateProfiles } from "@/lib/templates";

export async function GET() {
  return NextResponse.json(getTemplateProfiles());
}
