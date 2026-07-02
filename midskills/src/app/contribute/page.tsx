import type { Metadata } from "next";
import { ContributeContent } from "@/components/contribute/contribute-content";
import { loadRegistry } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Contribute | MIDSKILLS",
  description: "How to add skills, templates, and knowledge references to the Midnight Network skills marketplace.",
};

export default function ContributePage() {
  const site = loadRegistry().site;
  return <ContributeContent repository={site?.repository} />;
}
