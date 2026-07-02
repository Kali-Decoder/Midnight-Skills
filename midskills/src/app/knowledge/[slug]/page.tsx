import { notFound } from "next/navigation";
import { getKnowledgeArticle, getKnowledgeArticles } from "@/lib/knowledge";
import { KbDetailContent } from "@/components/knowledge/kb-detail-content";

export async function generateStaticParams() {
  return getKnowledgeArticles().map((a) => ({ slug: a.slug }));
}

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getKnowledgeArticle(slug);
  if (!article) notFound();
  return <KbDetailContent article={article} />;
}
