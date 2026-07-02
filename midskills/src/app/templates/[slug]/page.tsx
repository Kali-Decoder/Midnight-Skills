import { notFound } from "next/navigation";
import { getTemplateProfile, getTemplateProfiles } from "@/lib/templates";
import { TemplateDetailContent } from "@/components/templates/template-detail-content";

export async function generateStaticParams() {
  return getTemplateProfiles().map((t) => ({ slug: t.slug }));
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = getTemplateProfile(slug);
  if (!template) notFound();
  return <TemplateDetailContent template={template} />;
}
