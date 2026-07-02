import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/shared/page-header";
import { KbCard } from "@/components/knowledge/kb-card";
import { getKnowledgeArticles } from "@/lib/knowledge";

export default function KnowledgePage() {
  const articles = getKnowledgeArticles();
  return (
    <Container className="safe-bottom py-8 sm:py-12">
      <PageHeader
        title="Knowledge Base"
        description="Shared references — provider wiring, version pins, and common gotchas for Midnight dApps."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <KbCard key={a.slug} article={a} />
        ))}
      </div>
    </Container>
  );
}
