import { HeroSection } from "@/components/landing/hero-section";
import { SupportedToolsSection } from "@/components/shared/supported-tools-showcase";
import { HowToShowcase } from "@/components/landing/how-to-showcase";
import { ValueProps } from "@/components/landing/value-props";
import { FeaturedSkills } from "@/components/landing/featured-skills";
import { HomeExpansion } from "@/components/landing/home-expansion";
import { EcosystemVision } from "@/components/landing/ecosystem-vision";
import { FaqSection } from "@/components/landing/faq-section";
import { getFeaturedHeroSkills, getSkillProfiles } from "@/lib/skills";
import { getTemplateCount } from "@/lib/templates";
import { getKnowledgeArticles } from "@/lib/knowledge";
import { getCollections } from "@/lib/collections";

export default function HomePage() {
  const collections = getCollections();
  const heroSkills = getFeaturedHeroSkills();

  return (
    <div className="landing-page">
      <HeroSection skills={heroSkills} />
      <HowToShowcase skills={heroSkills} />
      <ValueProps />
      <SupportedToolsSection />
      <HomeExpansion
        collections={collections}
        stats={{
          skills: getSkillProfiles().length,
          templates: getTemplateCount(),
          knowledge: getKnowledgeArticles().length,
        }}
      />
      <FeaturedSkills />
      <EcosystemVision />
      <FaqSection />
    </div>
  );
}
