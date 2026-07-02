import { getTemplateProfiles } from "@/lib/templates";
import { TemplatesPageContent } from "@/components/templates/templates-page-content";

export default function TemplatesPage() {
  const templates = getTemplateProfiles();
  return <TemplatesPageContent templates={templates} />;
}
