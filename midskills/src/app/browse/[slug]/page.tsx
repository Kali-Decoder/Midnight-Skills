import { notFound } from "next/navigation";
import { getSkillProfile, getSkillProfiles } from "@/lib/skills";
import { SkillDetailContent } from "@/components/skills/skill-detail-content";

export async function generateStaticParams() {
  return getSkillProfiles().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = getSkillProfile(slug);
  if (!profile) return {};
  return { title: `${profile.meta.name} | MIDSKILLS`, description: profile.meta.description };
}

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = getSkillProfile(slug);
  if (!profile) notFound();
  return <SkillDetailContent profile={profile} />;
}
