import { NextResponse } from "next/server";
import { getKnowledgeArticle } from "@/lib/knowledge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(article.kbMd, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
