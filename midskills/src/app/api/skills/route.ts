import { NextResponse } from "next/server";
import { getSkillProfiles } from "@/lib/skills";

export async function GET() {
  return NextResponse.json(getSkillProfiles());
}
