export interface TemplateProfile {
  slug: string;
  name: string;
  description: string;
  skillId: string;
  skillSlug: string;
  path: string;
  readme: string;
  files: string[];
  category: string;
  difficulty: string;
  tags: string[];
  /** Has a clone-and-run repo under templates/ */
  runnable: boolean;
  /** Primary link for the template card */
  detailHref: string;
}

/** Lightweight shape for listing pages — avoids shipping huge SKILL.md bodies over RSC */
export interface TemplateListItem {
  slug: string;
  name: string;
  description: string;
  skillId: string;
  skillSlug: string;
  path: string;
  fileCount: number;
  keyFiles: string[];
  category: string;
  difficulty: string;
  tags: string[];
  runnable: boolean;
  detailHref: string;
  readmePreview: string;
}
