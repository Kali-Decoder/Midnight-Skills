import { BrandBanner } from "@/components/shared/brand-logo";
import { HeroSection, SupportedToolsBanner } from "@/components/landing/hero-section";
import { SupportedToolsSection } from "@/components/shared/supported-tools-showcase";
import { ValueProps } from "@/components/landing/value-props";
import { FeaturedSkills } from "@/components/landing/featured-skills";
import { HomeExpansion } from "@/components/landing/home-expansion";
import { EcosystemVision } from "@/components/landing/ecosystem-vision";
import { FaqSection } from "@/components/landing/faq-section";
import { Container } from "@/components/layout/container";
import { getSkillProfiles } from "@/lib/skills";
import { getTemplateProfiles } from "@/lib/templates";
import { getKnowledgeArticles } from "@/lib/knowledge";
import { getCollections } from "@/lib/collections";

export default function HomePage() {
  const collections = getCollections();
  return (
    <div className="landing-page">
      <section className="border-b border-[var(--brand-border)]">
        <Container className="py-4 sm:py-6">
          <BrandBanner className="rounded-xl" />
        </Container>
      </section>
      <SupportedToolsBanner />
      <HeroSection />
      <ValueProps />
      <SupportedToolsSection />
      <HomeExpansion
        collections={collections}
        stats={{
          skills: getSkillProfiles().length,
          templates: getTemplateProfiles().length,
          knowledge: getKnowledgeArticles().length,
        }}
      />
      <FeaturedSkills />
      <EcosystemVision />
      <FaqSection />
    </div>
  );
}
