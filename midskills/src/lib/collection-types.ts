export interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string;
  skillSlugs: string[];
  skills: { skillId: string; summary: string }[];
}
