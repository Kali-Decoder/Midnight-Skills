import { NextResponse } from "next/server";
import { getTemplateListItems } from "@/lib/templates";

export async function GET() {
  return NextResponse.json(getTemplateListItems());
}
