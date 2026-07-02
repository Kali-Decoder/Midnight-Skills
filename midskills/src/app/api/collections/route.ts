import { NextResponse } from "next/server";
import { getCollections } from "@/lib/collections";

export async function GET() {
  return NextResponse.json(getCollections());
}
